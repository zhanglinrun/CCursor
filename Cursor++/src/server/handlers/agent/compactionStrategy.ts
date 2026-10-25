import type { LLMMessage, LLMTool } from '../llm/types'
import type { HistoryEntry } from './historyManager'
import { createHash } from 'node:crypto'
import { create, toBinary } from '@bufbuild/protobuf'
import { ConversationSummaryArchiveSchema } from '../../gen/agent_v1_pb'
import { encodeBlob } from './blob'
import { cacheBlob, getCachedBlob } from './blobStore'
import {
  COMPACTION_LONG_BODY_KEEP_TAIL,
  COMPACTION_LONG_BODY_THRESHOLD,
  COMPACTION_MEDIUM_BODY_KEEP_TAIL,
  COMPACTION_MEDIUM_BODY_THRESHOLD,
} from './constants'
import { isPreambleUserMessage, isSummaryBlobMessage, materializeHistoryEntries } from './historyManager'
import { countTokens } from './tokenCounter'

export interface CompactionPlan {
  leading: HistoryEntry[]
  summarizeEntries: HistoryEntry[]
  keepTail: HistoryEntry[]
}

export interface CompactionArtifacts {
  summaryText: string
  summaryBlobId: string
  summaryBlobData: string
  archiveBlobs: Array<{ blobId: string, blobData: string, blobDataRaw?: Uint8Array }>
  historyBlobs: Array<{ blobId: string, blobData: string }>
  nextRootBlobIds: string[]
  nextSummaryArchiveIds: string[]
}

/**
 * 被摘要吞掉的 MCP schema 占位符。
 *
 * GetDynamicTools 返回的是工具 schema —— 事实性数据,不是对话历史。
 * 把它原样喂给摘要器有两个害处:
 *   1. 单次 namespace 查询约 6k tokens,白白撑大 summary prompt
 *   2. 摘要成自然语言后 schema 精度丢失,而 LLM 会"记得"自己查过这些工具,
 *      于是拿着编造的参数去调 CallDynamicTool
 *
 * 好在 <dynamic_tools> 段在 system prompt 里,compaction 的 leading 会完整保留 ——
 * namespace 清单不丢,只丢 schema。所以这里显式告诉后续轮次"重查一次"即可。
 */
const DYNAMIC_TOOLS_SCHEMA_PLACEHOLDER
  = '<tool schemas omitted from summary — call GetDynamicTools again before using these tools>'

function formatToolResultForSummary(toolName: string | undefined, content: string): string {
  if (toolName === 'GetDynamicTools')
    return `[tool result] GetDynamicTools: ${DYNAMIC_TOOLS_SCHEMA_PLACEHOLDER}`
  return `[tool result] ${toolName ?? ''}: ${content.trim()}`
}

export function formatMessageForSummary(message: LLMMessage): string {
  const lines: string[] = []

  if (typeof message.content === 'string') {
    const text = message.content.trim()
    // OpenAI/Gemini 形态: 工具结果是 role='tool' 的字符串消息。
    // 只拦 GetDynamicTools,其余保持原有输出格式不动。
    if (message.role === 'tool' && message.toolName === 'GetDynamicTools')
      lines.push(formatToolResultForSummary(message.toolName, text))
    else if (text)
      lines.push(text)
  }
  else {
    for (const block of message.content) {
      switch (block.type) {
        case 'text':
          if (block.text.trim())
            lines.push(block.text.trim())
          break
        case 'thinking':
          if (block.text.trim())
            lines.push(`[thinking] ${block.text.trim()}`)
          break
        case 'tool_use':
          lines.push(`[tool call] ${block.name} ${JSON.stringify(block.input)}`)
          break
        case 'tool_result':
          // Anthropic 形态: 工具结果是 user 消息里的 content block
          lines.push(formatToolResultForSummary(block.toolName ?? block.toolUseId, block.content))
          break
      }
    }
  }

  const text = lines.join('\n').trim()
  return text ? `${message.role}:\n${text}` : ''
}

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateMessagesTokens(messages: Array<LLMMessage | { role: string, content: string }>): number {
  return messages.reduce((sum, message) => sum + estimateTextTokens(typeof message.content === 'string' ? message.content : formatMessageForSummary(message as LLMMessage)), 0)
}

/** 请求估算不省略动态工具结果，且把工具定义与消息封装一同计入。 */
export function estimateRequestTokens(messages: LLMMessage[], tools: LLMTool[] = []): number {
  let imageTokens = 0
  const serialized = JSON.stringify({ messages, ...(tools.length ? { tools } : {}) }, (_key, value) => {
    if (value && typeof value === 'object' && value.type === 'image') {
      imageTokens += 1600 // shortcut: 图像按固定保守值估算，实际 usage 可纠正；不是模型精确图像计费。
      return { type: 'image', mimeType: value.mimeType }
    }
    return value
  })
  return countTokens(serialized) + imageTokens
}

/** PI 成功摘要覆盖整个旧窗口；只有正在继续的任务保留最近一条用户指令。 */
export function planCheckpointCompaction(entries: HistoryEntry[], retainedUserTokens = 0): CompactionPlan {
  const leading = planCompaction(entries).leading
  const body = entries.slice(leading.length)
  const latestUser = [...body].reverse().find(entry => entry.message.role === 'user'
    && (typeof entry.message.content === 'string' || entry.message.content.some(block => block.type === 'text' || block.type === 'image')))
  if (!latestUser || retainedUserTokens <= 0)
    return { leading, summarizeEntries: body, keepTail: [] }
  const message: LLMMessage = {
    ...latestUser.message,
    content: typeof latestUser.message.content === 'string' ? latestUser.message.content : latestUser.message.content.filter(block => block.type === 'text' || block.type === 'image'),
  }
  if (estimateRequestTokens([message]) > retainedUserTokens) {
    const text = typeof message.content === 'string' ? message.content : message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    const marker = '\n[Latest instruction shortened for the retained window; full text included in the summary input.]'
    let low = 0
    let high = text.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (estimateRequestTokens([{ role: 'user', content: text.slice(0, middle) + marker }]) <= retainedUserTokens)
        low = middle
      else high = middle - 1
    }
    message.content = text.slice(0, low) + marker
    if (estimateRequestTokens([message]) > retainedUserTokens)
      return { leading, summarizeEntries: body, keepTail: [] }
  }
  return { leading, summarizeEntries: body, keepTail: materializeHistoryEntries([message]) }
}

export function planCompaction(entries: HistoryEntry[], minKeepTailCount = 0): CompactionPlan {
  const leading: HistoryEntry[] = []
  let index = 0

  if (entries[index]?.message.role === 'system') {
    leading.push(entries[index])
    index += 1
  }
  if (entries[index] && isPreambleUserMessage(entries[index].message)) {
    leading.push(entries[index])
    index += 1
  }

  const body = entries.slice(index)
  let keepTailCount = body.length > COMPACTION_LONG_BODY_THRESHOLD
    ? COMPACTION_LONG_BODY_KEEP_TAIL
    : body.length > COMPACTION_MEDIUM_BODY_THRESHOLD
      ? COMPACTION_MEDIUM_BODY_KEEP_TAIL
      : 0
  let summarizeCount = Math.max(0, body.length - keepTailCount)

  if (summarizeCount === 0 && body.length > COMPACTION_MEDIUM_BODY_THRESHOLD) {
    keepTailCount = COMPACTION_MEDIUM_BODY_KEEP_TAIL
    summarizeCount = Math.max(0, body.length - keepTailCount)
  }

  keepTailCount = Math.max(keepTailCount, minKeepTailCount)
  summarizeCount = Math.max(0, body.length - keepTailCount)

  // tool 配对完整性: 确保切分点不在 tool call/result 之间。
  //
  // 消息序列: assistant(tool_use:A) → tool(result:A) → assistant(tool_use:B) → tool(result:B)
  //
  // 如果 keepTail 以 tool role 开头, 其配对的 assistant(tool_use) 在 summarize 侧,
  // 发给 OpenAI 时报 "No tool call found for function call output"。
  //
  // 向前扩展 keepTail 到所属 assistant 即可: 后续 tool results 都在 tail 内。
  // 继续跨过该 assistant 会把更早的工具轮次也拉回 tail, 导致长工具链无法压缩。
  while (summarizeCount > 0) {
    const first = body[summarizeCount]
    if (!first)
      break
    // keepTail 首条是 tool result → 配对的 tool_call 在 summarize 侧
    if (first.message.role === 'tool') {
      summarizeCount--
      continue
    }
    break
  }

  return {
    leading,
    summarizeEntries: body.slice(0, summarizeCount),
    keepTail: body.slice(summarizeCount),
  }
}

function encodeBinaryBlob(bytes: Uint8Array): { blobId: string, blobData: string, blobDataRaw: Uint8Array } {
  const blobData = Buffer.from(bytes).toString('base64')
  const blobId = createHash('sha256').update(blobData).digest('base64')
  return { blobId, blobData, blobDataRaw: bytes }
}

export function createCompactionArtifacts(params: {
  plan: CompactionPlan
  summaryText: string
  previousSummaryArchiveIds: string[]
  knownBlobIds?: string[]
}): CompactionArtifacts {
  const summaryBlob = encodeBlob({
    role: 'assistant',
    content: `Previous conversation summary:\n${params.summaryText}`,
    providerOptions: { cursor: { isSummary: true } },
  })
  cacheBlob(summaryBlob.blobId, summaryBlob.blobData)

  const archiveSourceBlobIds = params.plan.summarizeEntries
    .filter(entry => !isSummaryBlobMessage(entry.raw))
    .map(entry => entry.blobId)

  const archiveBlobs: Array<{ blobId: string, blobData: string, blobDataRaw?: Uint8Array }> = []
  let nextSummaryArchiveIds = [...params.previousSummaryArchiveIds]
  if (archiveSourceBlobIds.length > 0) {
    const encoder = new TextEncoder()
    const archiveMessage = create(ConversationSummaryArchiveSchema, {
      summarizedMessages: archiveSourceBlobIds.map(blobId => encoder.encode(blobId)),
      summary: params.summaryText,
      windowTail: params.plan.keepTail.length,
      summaryMessage: encoder.encode(summaryBlob.blobId),
    })
    const archiveBlob = encodeBinaryBlob(toBinary(ConversationSummaryArchiveSchema, archiveMessage))
    cacheBlob(archiveBlob.blobId, archiveBlob.blobData)
    archiveBlobs.push(archiveBlob)
    nextSummaryArchiveIds = [...nextSummaryArchiveIds, archiveBlob.blobId]
  }

  // 修复/重建历史会产生新引用，包含归档源；必须先发到客户端再提交 checkpoint。
  const knownBlobIds = new Set(params.knownBlobIds)
  const historyBlobs = [...new Set([
    ...params.plan.leading,
    ...params.plan.summarizeEntries,
    ...params.plan.keepTail,
  ].map(entry => entry.blobId))]
    .filter(blobId => !knownBlobIds.has(blobId))
    .map((blobId) => {
      const blobData = getCachedBlob(blobId)
      if (!blobData)
        throw new Error('Compaction history blob is unavailable; history preserved.')
      return { blobId, blobData }
    })

  return {
    summaryText: params.summaryText,
    summaryBlobId: summaryBlob.blobId,
    summaryBlobData: summaryBlob.blobData,
    archiveBlobs,
    historyBlobs,
    nextRootBlobIds: [
      ...params.plan.leading.map(entry => entry.blobId),
      summaryBlob.blobId,
      ...params.plan.keepTail.map(entry => entry.blobId),
    ],
    nextSummaryArchiveIds,
  }
}
