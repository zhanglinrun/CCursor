import type { AgentServerMessage } from '../../gen/agent_v1_pb'
import type { RepairDiagnostics } from '../llm/transformMessages'
import type { LLMContentBlock, LLMMessage } from '../llm/types'
import type { CompactionArtifacts } from './compactionStrategy'
import type { AgentSession } from './session'
import type { BlobMessage } from './transcript'
import { logger } from '../../logger'
import { restoreStoredMessage } from '../llm/storedTranscript'
import { createRepairDiagnostics, hasRepairMutations, repairConversationHistory } from '../llm/transformMessages'
import { decodeBlob, decodeLegacyHistoryBlob, encodeBlob } from './blob'
import { cacheBlob, getCachedBlob } from './blobStore'
import { waitForMessageMatching } from './session'
import { kvMessage } from './stream'
import { normalizeBlobMessage, restoreBlobMessageToLLMMessage, toOfficialCoreMessages } from './transcript'
import { throwIfSessionCancelled, waitForPromiseWithHeartbeat } from './wait'

export interface HistoryEntry {
  blobId: string
  raw: Record<string, unknown>
  message: LLMMessage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

type BuildKvMessage = (id: number, blobId: string, blobData: string) => AgentServerMessage

export function* sendAndCacheBlob(
  buildKvMessage: BuildKvMessage,
  id: number,
  data: BlobMessage,
  blobIds: string[],
): Generator<AgentServerMessage, number, void> {
  let nextId = id
  for (const message of toOfficialCoreMessages(normalizeBlobMessage(data))) {
    const blob = encodeBlob(message)
    blobIds.push(blob.blobId)
    cacheBlob(blob.blobId, blob.blobData)
    yield buildKvMessage(nextId++, blob.blobId, blob.blobData)
  }
  return nextId - 1
}

async function* waitForBlobWrites(session: AgentSession, pending: Set<number>): AsyncGenerator<AgentServerMessage, Set<number>, void> {
  const wait = async () => {
    const received = new Set<number>()
    const deadline = Date.now() + 2_000
    while (pending.size > 0) {
      const message = await waitForMessageMatching(session, (message) => {
        const kv = message.kvClientMessage
        return isRecord(kv) && typeof kv.id === 'number' && pending.has(kv.id) && isRecord(kv.setBlobResult)
      }, Math.max(0, deadline - Date.now()))
      if (!message)
        break
      const kv = message.kvClientMessage as { id: number, setBlobResult: { error?: unknown } }
      pending.delete(kv.id)
      if (!kv.setBlobResult.error)
        received.add(kv.id)
    }
    return received
  }
  const received = yield* waitForPromiseWithHeartbeat(wait())
  throwIfSessionCancelled(session)
  return received
}

export async function* writeCompactionBlobs(artifacts: CompactionArtifacts, session: AgentSession | null): AsyncGenerator<AgentServerMessage, boolean, void> {
  const blobs: Array<{ blobId: string, blobData: string, blobDataRaw?: Uint8Array }> = [
    ...artifacts.historyBlobs,
    { blobId: artifacts.summaryBlobId, blobData: artifacts.summaryBlobData },
    ...artifacts.archiveBlobs,
  ]
  let requestId = session?.nextCompactionBlobRequestId ?? 1
  const pending = new Set<number>()
  for (const blob of blobs) {
    pending.add(requestId)
    yield kvMessage(requestId++, blob.blobId, blob.blobData, blob.blobDataRaw)
  }
  if (session?.nextCompactionBlobRequestId === undefined)
    return true
  session.nextCompactionBlobRequestId = requestId
  const confirmed = yield* waitForBlobWrites(session, pending)
  return confirmed.size === blobs.length
}

/** Stage replacements for local legacy roots and return only client-acknowledged IDs. */
export async function* migrateLegacyRootBlobs(
  blobIds: string[],
  session: AgentSession | null,
  blobCounter = 0,
): AsyncGenerator<AgentServerMessage, { blobIds: string[], blobCounter: number }, void> {
  if (!session || session.closed)
    return { blobIds, blobCounter }

  const replacements = new Map<string, string[]>()
  const writes = new Map<string, string>()
  for (const id of new Set(blobIds)) {
    const blobData = getCachedBlob(id)
    if (!blobData)
      continue
    try {
      const decoded = decodeLegacyHistoryBlob(id, blobData)
      if (!isRecord(decoded) || !['system', 'user', 'assistant', 'tool'].includes(String(decoded.role)))
        continue
      const stored = restoreStoredMessage(decoded)
      if (!stored)
        continue
      const blobs = toOfficialCoreMessages(stored).map(encodeBlob)
      replacements.set(id, blobs.map(blob => blob.blobId))
      for (const blob of blobs)
        writes.set(blob.blobId, blob.blobData)
    }
    catch {
      // A missing or undecodable legacy value remains under its original reference.
    }
  }

  if (writes.size === 0)
    return { blobIds, blobCounter }

  const pending = new Map<number, { id: string, data: string }>()
  for (const [id, data] of writes) {
    const requestId = ++blobCounter
    pending.set(requestId, { id, data })
    yield kvMessage(requestId, id, data)
  }

  const confirmed = yield* waitForBlobWrites(session, new Set(pending.keys()))
  const acknowledged = new Set<string>()
  for (const requestId of confirmed) {
    const { id, data } = pending.get(requestId)!
    cacheBlob(id, data)
    acknowledged.add(id)
  }
  return {
    blobIds: blobIds.flatMap((id) => {
      const next = replacements.get(id)
      return next?.every(id => acknowledged.has(id)) ? next : [id]
    }),
    blobCounter,
  }
}

export function* flushMessageBlobs(
  buildKvMessage: BuildKvMessage,
  messages: LLMMessage[],
  startIndex: number,
  blobCounter: number,
  blobIds: string[],
): Generator<AgentServerMessage, { nextIndex: number, blobCounter: number }, void> {
  let nextIndex = startIndex
  let nextBlobCounter = blobCounter

  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i]
    nextBlobCounter = yield* sendAndCacheBlob(buildKvMessage, nextBlobCounter + 1, msg, blobIds)
    nextIndex = i + 1
  }

  return { nextIndex, blobCounter: nextBlobCounter }
}

export function extractPlainTextContent(message: LLMMessage): string {
  if (typeof message.content === 'string')
    return message.content
  return message.content
    .filter((block): block is Extract<LLMContentBlock, { type: 'text' | 'thinking' }> => block.type === 'text' || block.type === 'thinking')
    .map(block => block.text)
    .join('')
}

export function extractComparableUserTexts(message: LLMMessage): string[] {
  const text = extractPlainTextContent(message).trim()
  if (!text)
    return []

  const values = new Set<string>([text])
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const userQueryMatches = text.matchAll(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/g)
  for (const match of userQueryMatches) {
    const inner = match[1]?.trim()
    if (inner)
      values.add(inner)
  }

  return [...values]
}

export function hasSystemMessage(messages: LLMMessage[]): boolean {
  return messages.some(message => message.role === 'system')
}

export function isPreambleUserMessage(message: LLMMessage): boolean {
  if (message.role !== 'user' || typeof message.content !== 'string')
    return false
  return message.content.includes('<user_info>')
    && !message.content.includes('<user_query>')
}

export function hasPreambleUserMessage(messages: LLMMessage[]): boolean {
  return messages.some(isPreambleUserMessage)
}

function syncConversationScaffold(messages: LLMMessage[], systemMessage: LLMMessage, preambleUserMessage: LLMMessage): { messages: LLMMessage[], systemReplaced: boolean, preambleReplaced: boolean } {
  const next = [...messages]
  let systemReplaced = false
  let preambleReplaced = false

  const systemIndex = next.findIndex(message => message.role === 'system')
  if (systemIndex >= 0 && next[systemIndex]?.content !== systemMessage.content) {
    next[systemIndex] = systemMessage
    systemReplaced = true
  }

  const preambleIndex = next.findIndex(isPreambleUserMessage)
  if (preambleIndex >= 0 && next[preambleIndex]?.content !== preambleUserMessage.content) {
    next[preambleIndex] = preambleUserMessage
    preambleReplaced = true
  }

  return { messages: next, systemReplaced, preambleReplaced }
}

export function mergePrependUserMessages(
  messages: LLMMessage[],
  prependUserMessages: Array<{ text: string, messageId?: string }>,
): { messages: LLMMessage[], insertedTexts: string[] } {
  if (prependUserMessages.length === 0)
    return { messages, insertedTexts: [] }

  const existingUserTexts = new Set(
    messages
      .filter(message => message.role === 'user')
      .flatMap(extractComparableUserTexts)
      .filter(text => text.length > 0),
  )

  const missing = prependUserMessages
    .map(entry => entry.text)
    .filter(text => text.length > 0 && !existingUserTexts.has(text))

  if (missing.length === 0) {
    logger.info({ prependCount: prependUserMessages.length }, '[SESSION] prepend user messages already satisfied by history')
    return { messages, insertedTexts: [] }
  }

  const insertAt = messages.findIndex(message => message.role !== 'system' && !isPreambleUserMessage(message))
  const prefix = missing.map(text => ({ role: 'user' as const, content: text }))

  logger.info({
    prependCount: prependUserMessages.length,
    missingCount: missing.length,
    firstMissing: missing[0],
  }, '[SESSION] merging prepend user messages into history')

  if (insertAt === -1)
    return { messages: [...messages, ...prefix], insertedTexts: missing }
  return {
    messages: [...messages.slice(0, insertAt), ...prefix, ...messages.slice(insertAt)],
    insertedTexts: missing,
  }
}

export function isSummaryBlobMessage(raw: Record<string, unknown>): boolean {
  const providerOptions = raw.providerOptions
  if (!isRecord(providerOptions))
    return false
  const cursor = providerOptions.cursor
  return isRecord(cursor) && cursor.isSummary === true
}

export function hydrateHistoryEntries(blobIds: string[]): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const blobId of blobIds) {
    const blobData = getCachedBlob(blobId)
    if (!blobData)
      continue
    try {
      const decoded = decodeBlob(blobData)
      if (!isRecord(decoded))
        continue
      const restored = restoreBlobMessageToLLMMessage(decoded)
      if (!restored)
        continue
      entries.push({ blobId, raw: decoded, message: restored })
    }
    catch (error) {
      logger.warn({ blobId, error: (error as Error).message }, '[SESSION] failed to hydrate history entry')
    }
  }
  return entries
}

export function materializeHistoryEntries(messages: LLMMessage[], originalEntries: HistoryEntry[] = []): HistoryEntry[] {
  const originalByMessage = new Map(originalEntries.map(entry => [entry.message, entry.raw]))
  return messages.flatMap((message) => {
    const original = originalByMessage.get(message)
    const normalized = (original && restoreStoredMessage(original)) ?? normalizeBlobMessage(message)
    const official = toOfficialCoreMessages(normalized)
    return official.map((raw) => {
      const blob = encodeBlob(raw)
      cacheBlob(blob.blobId, blob.blobData)
      return {
        blobId: blob.blobId,
        raw,
        message: raw.role === message.role && official.length === 1 ? message : restoreBlobMessageToLLMMessage(raw)!,
      }
    })
  })
}

function logHistoryRepair(stage: string, diagnostics: RepairDiagnostics, extra: Record<string, unknown> = {}): void {
  if (!hasRepairMutations(diagnostics))
    return
  logger.debug({
    stage,
    ...extra,
    ...diagnostics,
  }, '[HISTORY_REPAIR] canonicalized conversation history')
}

export function repairHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const diagnostics = createRepairDiagnostics(entries.length)
  const repaired = repairConversationHistory(entries.map(entry => entry.message), diagnostics)
  logHistoryRepair('repairHistoryEntries', diagnostics, {
    entryCount: entries.length,
    inputBlobIds: entries.length,
  })
  return materializeHistoryEntries(repaired, entries)
}

export function* rebuildConversationHistory(params: {
  historyBlobIds: string[]
  prependUserMessages: Array<{ text: string, messageId?: string }>
  systemMessage: LLMMessage
  preambleUserMessage: LLMMessage
  currentUserMessage: LLMMessage
  systemContent: string
  preambleUserContent: string
  sendSystemScaffoldBlob: (data: { role: string, content: unknown, toolCallId?: string, toolName?: string, isError?: boolean }) => Generator<AgentServerMessage, void, void>
  sendOrderedBlob: (data: { role: string, content: unknown, toolCallId?: string, toolName?: string, isError?: boolean }) => Generator<AgentServerMessage, void, void>
}): Generator<AgentServerMessage, { messages: LLMMessage[], insertedPrependUserTexts: string[] }, void> {
  let messages: LLMMessage[] = []
  let insertedPrependUserTexts: string[] = []

  if (params.historyBlobIds.length > 0) {
    const historyEntries = hydrateHistoryEntries(params.historyBlobIds)
    logger.info({
      requestedBlobs: params.historyBlobIds.length,
      resolvedBlobs: historyEntries.length,
      prependUserMessages: params.prependUserMessages.length,
    }, '[SESSION] history blobs from cache')

    messages = historyEntries.map(entry => entry.message)

    const scaffoldSynced = syncConversationScaffold(messages, params.systemMessage, params.preambleUserMessage)
    messages = scaffoldSynced.messages
    if (scaffoldSynced.systemReplaced || scaffoldSynced.preambleReplaced) {
      logger.debug({
        systemReplaced: scaffoldSynced.systemReplaced,
        preambleReplaced: scaffoldSynced.preambleReplaced,
      }, '[HISTORY_REPAIR] replaced provider-specific scaffold in restored history')
    }

    if (!hasSystemMessage(messages)) {
      messages.unshift(params.systemMessage)
      yield* params.sendSystemScaffoldBlob({ role: 'system', content: params.systemContent })
    }

    if (!hasPreambleUserMessage(messages)) {
      const insertAt = messages.findIndex(message => message.role !== 'system')
      if (insertAt === -1)
        messages.push(params.preambleUserMessage)
      else messages.splice(insertAt, 0, params.preambleUserMessage)
      yield* params.sendOrderedBlob({ role: 'user', content: params.preambleUserContent })
    }

    ({ messages, insertedTexts: insertedPrependUserTexts } = mergePrependUserMessages(messages, params.prependUserMessages))
    messages.push(params.currentUserMessage)
  }
  else {
    messages.push(params.systemMessage)
    yield* params.sendSystemScaffoldBlob({ role: 'system', content: params.systemContent })

    messages.push(params.preambleUserMessage)
    yield* params.sendOrderedBlob({ role: 'user', content: params.preambleUserContent });

    ({ messages, insertedTexts: insertedPrependUserTexts } = mergePrependUserMessages(messages, params.prependUserMessages))
    messages.push(params.currentUserMessage)
  }

  const diagnostics = createRepairDiagnostics(messages.length)
  const repaired = repairConversationHistory(messages, diagnostics)
  logHistoryRepair('rebuildConversationHistory', diagnostics, {
    historyBlobIds: params.historyBlobIds.length,
    insertedPrependUserTexts: insertedPrependUserTexts.length,
  })

  return {
    messages: repaired,
    insertedPrependUserTexts,
  }
}
