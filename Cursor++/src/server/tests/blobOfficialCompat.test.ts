import type { AgentServerMessage } from '../gen/agent_v1_pb'
import type { LLMMessage } from '../handlers/llm/types'
import { createHash } from 'node:crypto'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AgentServerMessageSchema, ConversationSummaryArchiveSchema, ConversationTurnStructureSchema } from '../gen/agent_v1_pb'
import { decodeBlob, encodeBinaryBlob, encodeBlob } from '../handlers/agent/blob'
import { cacheBlob, getCachedBlob, resetBlobCacheForTests } from '../handlers/agent/blobStore'
import { createCompactionArtifacts } from '../handlers/agent/compactionStrategy'
import { handleConversationRun } from '../handlers/agent/conversationRuntime'
import { flushMessageBlobs, hydrateHistoryEntries, migrateLegacyRootBlobs, repairHistoryEntries } from '../handlers/agent/historyManager'
import { parseRunRequest } from '../handlers/agent/protocol'
import { createEphemeralSession, markSessionClosed, pushSessionMessage } from '../handlers/agent/session'
import { kvMessage } from '../handlers/agent/stream'
import { handleSummarizeAction } from '../handlers/agent/summarizeRuntime'
import { resolveProviderRuntime } from '../handlers/llm'

vi.mock('../database/blobs', () => ({ persistBlob: async () => {} }))
vi.mock('../database/checkpoints', () => ({
  clearDraftCheckpoint: async () => {},
  persistConversationCheckpoint: () => {},
}))
vi.mock('../handlers/agent/hookRuntime', () => ({ async* executePreCompactHook() {} }))

beforeEach(() => {
  resetBlobCacheForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function legacyBlob(message: unknown, uploaded = false) {
  const encoded = Buffer.from(JSON.stringify(message)).toString('base64')
  const id = createHash('sha256').update(encoded).digest('base64')
  const data = uploaded ? Buffer.from(encoded).toString('base64') : encoded
  cacheBlob(id, data)
  return { id, data }
}

function readKvFrame(frame: AgentServerMessage) {
  const parsed = fromBinary(AgentServerMessageSchema, toBinary(AgentServerMessageSchema, frame))
  if (parsed.message.case !== 'kvServerMessage' || parsed.message.value.message.case !== 'setBlobArgs')
    throw new Error('Expected a KV write frame')
  const { blobId, blobData } = parsed.message.value.message.value
  return { requestId: parsed.message.value.id, id: Buffer.from(blobId).toString('utf8'), bytes: Buffer.from(blobData) }
}

it('writes UTF-8 CoreMessage JSON and keeps the cache in Base64', () => {
  const messages: LLMMessage[] = [
    { role: 'system', content: 'Synthetic system prompt' },
    { role: 'user', content: [{ type: 'text', text: '查看样本' }, { type: 'image', data: 'aW1hZ2U=', mimeType: 'image/png' }] },
    { role: 'assistant', content: [
      { type: 'thinking', text: 'Synthetic reasoning', signature: 'sig-1', providerOptions: { cursor: { modelName: 'fixture' } } },
      { type: 'tool_use', id: 'call-1', name: 'Read', input: { path: 'fixture.txt' } },
    ] },
    { role: 'tool', toolCallId: 'call-1', toolName: 'Read', content: '无法读取', isError: true },
  ]
  const ids: string[] = []
  const frames = [...flushMessageBlobs(kvMessage, messages, 0, 0, ids)].map(readKvFrame)
  expect(frames.map(frame => frame.requestId)).toEqual([1, 2, 3, 4])
  expect(frames.map(frame => frame.id)).toEqual(ids)
  expect(frames.map(({ bytes }) => JSON.parse(bytes.toString('utf8')))).toEqual([
    messages[0],
    { role: 'user', content: [{ type: 'text', text: '查看样本' }, { type: 'image', image: 'data:image/png;base64,aW1hZ2U=', mimeType: 'image/png' }] },
    { role: 'assistant', content: [
      { type: 'reasoning', text: 'Synthetic reasoning', signature: 'sig-1', providerOptions: { cursor: { modelName: 'fixture' } } },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'Read', args: { path: 'fixture.txt' } },
    ] },
    { role: 'tool', id: 'call-1', content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'Read', result: '无法读取', isError: true }] },
  ])
  for (const { id, bytes } of frames) {
    expect(getCachedBlob(id)).toBe(bytes.toString('base64'))
    expect(id).toBe(createHash('sha256').update(bytes).digest('base64'))
  }
  expect(hydrateHistoryEntries(ids).map(entry => entry.message)).toEqual(messages)
})

it('hydrates old disk and upload encodings and repairs grouped official results', () => {
  const legacy = { role: 'tool', content: 'Legacy result', toolCallId: 'call-1', toolName: 'Read' }
  const once = legacyBlob(legacy)
  expect(decodeBlob(once.data)).toEqual(legacy)
  const twice = legacyBlob(legacy, true)
  expect(decodeBlob(twice.data)).toEqual(legacy)
  expect(decodeBlob(JSON.stringify(legacy))).toEqual(legacy)
  expect(hydrateHistoryEntries([twice.id])[0]?.message).toEqual(legacy)
  const assistant = encodeBlob({ role: 'assistant', content: [
    { type: 'tool-call', toolCallId: 'call-1', toolName: 'Read', args: '{"path":"fixture.txt"}' },
    { type: 'tool-call', toolCallId: 'call-2', toolName: 'Read', args: { path: 'next.txt' } },
  ] })
  const tool = encodeBlob({ role: 'tool', content: [
    { type: 'tool-result', toolCallId: 'call-1', toolName: 'Read', result: { text: 'one' }, experimental_content: [{ type: 'image', mimeType: 'image/png', data: 'AQID' }] },
    { type: 'tool-result', toolCallId: 'call-2', toolName: 'Read', result: 'two', isError: true },
  ] })
  cacheBlob(assistant.blobId, assistant.blobData)
  cacheBlob(tool.blobId, tool.blobData)
  const repaired = repairHistoryEntries(hydrateHistoryEntries([assistant.blobId, tool.blobId]))
  expect(repaired.map(entry => entry.message)).toMatchObject([
    { role: 'assistant', content: [{ id: 'call-1', input: { path: 'fixture.txt' } }, { id: 'call-2' }] },
    { role: 'tool', toolCallId: 'call-1', content: '{"text":"one"}' },
    { role: 'tool', toolCallId: 'call-2', content: 'two', isError: true },
  ])
  expect(repaired[1]?.raw).toMatchObject({ content: [{ result: { text: 'one' }, experimental_content: [{ type: 'image', data: 'AQID' }] }] })
})

it('adds new IDs for legacy roots only after matching successful acknowledgments', async () => {
  const legacy = legacyBlob({ role: 'user', content: [
    { type: 'tool-result', toolCallId: 'call-1', toolName: 'Read', result: 'tool output' },
    { type: 'text', text: 'Keep this instruction' },
  ] }, true)
  const system = legacyBlob({ role: 'system', content: 'System prompt' })
  const remappedId = 'client-remapped-history'
  cacheBlob(remappedId, legacy.data)
  const ids = [system.id, remappedId, 'missing-id']
  const firstSession = createEphemeralSession('fixture-first')
  const first = migrateLegacyRootBlobs(ids, firstSession, 2)
  const systemWrite = readKvFrame((await first.next()).value as AgentServerMessage)
  const toolWrite = readKvFrame((await first.next()).value as AgentServerMessage)
  const userWrite = readKvFrame((await first.next()).value as AgentServerMessage)
  const writes = [systemWrite, toolWrite, userWrite]
  expect(writes.map(write => write.requestId)).toEqual([3, 4, 5])
  expect(writes.map(write => JSON.parse(write.bytes.toString('utf8')).role)).toEqual(['system', 'tool', 'user'])
  expect(writes.map(write => getCachedBlob(write.id))).toEqual([undefined, undefined, undefined])
  expect(systemWrite.id).not.toBe(system.id)
  expect(userWrite.id).not.toBe(legacy.id)
  pushSessionMessage(firstSession, { kvClientMessage: { id: systemWrite.requestId, setBlobResult: {} } })
  pushSessionMessage(firstSession, { kvClientMessage: { id: toolWrite.requestId, setBlobResult: {} } })
  pushSessionMessage(firstSession, { kvClientMessage: { id: userWrite.requestId, setBlobResult: { error: {} } } })
  expect(await first.next()).toEqual({ done: true, value: { blobIds: [systemWrite.id, remappedId, 'missing-id'], blobCounter: 5 } })
  expect(getCachedBlob(legacy.id)).toBe(legacy.data)
  expect(getCachedBlob(system.id)).toBe(system.data)
  expect(getCachedBlob(userWrite.id)).toBeUndefined()

  const retrySession = createEphemeralSession('fixture-retry')
  const retry = migrateLegacyRootBlobs([systemWrite.id, legacy.id], retrySession)
  for (const id of [toolWrite.id, userWrite.id]) {
    const write = readKvFrame((await retry.next()).value as AgentServerMessage)
    expect(write.id).toBe(id)
    pushSessionMessage(retrySession, { kvClientMessage: { id: write.requestId, setBlobResult: {} } })
  }
  expect(await retry.next()).toEqual({ done: true, value: { blobIds: [systemWrite.id, toolWrite.id, userWrite.id], blobCounter: 2 } })
  expect(hydrateHistoryEntries([toolWrite.id, userWrite.id]).map(entry => entry.message)).toMatchObject([
    { role: 'tool', content: 'tool output', toolCallId: 'call-1' },
    { role: 'user', content: 'Keep this instruction' },
  ])
})

it('keeps the old root if the connection closes without a matching acknowledgment', async () => {
  const legacy = legacyBlob({ role: 'user', content: 'old user' })
  const session = createEphemeralSession('fixture-disconnect')
  const migration = migrateLegacyRootBlobs([legacy.id], session)
  const write = readKvFrame((await migration.next()).value as AgentServerMessage)
  pushSessionMessage(session, { kvClientMessage: { id: 999, setBlobResult: {} } })
  markSessionClosed(session)
  await expect(migration.next()).rejects.toThrow('client disconnected')
  expect(getCachedBlob(write.id)).toBeUndefined()
  expect(getCachedBlob(legacy.id)).toBe(legacy.data)
})

it('emits UTF-8 compaction history and summaries while archives and turns stay protobuf', () => {
  const legacy = legacyBlob({ role: 'user', content: 'Synthetic old history' })
  const history = repairHistoryEntries(hydrateHistoryEntries([legacy.id]))
  const artifacts = createCompactionArtifacts({
    plan: { leading: [], summarizeEntries: history, keepTail: [] },
    summaryText: '已处理合成记录',
    previousSummaryArchiveIds: [],
    knownBlobIds: [legacy.id],
  })
  const [historyBlob] = artifacts.historyBlobs
  expect(historyBlob.blobId).not.toBe(legacy.id)
  const historyWrite = readKvFrame(kvMessage(1, historyBlob.blobId, historyBlob.blobData))
  expect(JSON.parse(historyWrite.bytes.toString('utf8'))).toEqual({ role: 'user', content: [{ type: 'text', text: 'Synthetic old history' }] })
  const summaryWrite = readKvFrame(kvMessage(2, artifacts.summaryBlobId, artifacts.summaryBlobData))
  expect(JSON.parse(summaryWrite.bytes.toString('utf8'))).toEqual({
    role: 'assistant',
    content: 'Previous conversation summary:\n已处理合成记录',
    providerOptions: { cursor: { isSummary: true } },
  })
  const [archive] = artifacts.archiveBlobs
  const archiveWrite = readKvFrame(kvMessage(3, archive.blobId, archive.blobData, archive.blobDataRaw))
  const parsedArchive = fromBinary(ConversationSummaryArchiveSchema, archiveWrite.bytes)
  expect(parsedArchive.summarizedMessages.map(bytes => Buffer.from(bytes).toString('utf8'))).toEqual([historyWrite.id])
  expect(Buffer.from(parsedArchive.summaryMessage!).toString('utf8')).toBe(summaryWrite.id)
  const turnBytes = toBinary(ConversationTurnStructureSchema, create(ConversationTurnStructureSchema, {
    turn: { case: 'agentConversationTurn', value: { userMessage: Buffer.from(legacy.id) } },
  }))
  const turn = encodeBinaryBlob(turnBytes)
  const turnWrite = readKvFrame(kvMessage(4, turn.blobId, turn.blobData, turn.blobDataRaw))
  expect(turnWrite.bytes).toEqual(Buffer.from(turnBytes))
  const parsedTurn = fromBinary(ConversationTurnStructureSchema, turnWrite.bytes).turn
  expect(parsedTurn.case).toBe('agentConversationTurn')
  if (parsedTurn.case === 'agentConversationTurn')
    expect(Buffer.from(parsedTurn.value.userMessage).toString('utf8')).toBe(legacy.id)
})

it.each([
  ['manual', true],
  ['automatic', true],
  ['manual', false],
] as const)('%s compaction only publishes the checkpoint and archive when confirmed (%s)', async (mode, confirmed) => {
  const parsed = parseRunRequest({ runRequest: {
    conversationId: `synthetic-${mode}-kv`,
    modelDetails: { modelId: 'gpt-5.4-medium' },
    action: { userMessageAction: { userMessage: { text: 'Continue the synthetic task' }, requestContext: {} } },
  } })
  parsed.contextTokenLimit = 128_000
  parsed.historyTokenDetails = { usedTokens: 120_000, maxTokens: 128_000 }
  const oldUser = legacyBlob({ role: 'user', content: 'Synthetic fixture '.repeat(1500) }, true)
  const oldAssistant = legacyBlob({ role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'call-kv', toolName: 'Read', args: { path: 'fixture.txt' } }] })
  const oldTool = legacyBlob({ role: 'tool', toolCallId: 'call-kv', toolName: 'Read', content: 'Synthetic result' })
  const oldTail = legacyBlob({ role: 'assistant', content: 'Synthetic follow-up' })
  parsed.historyBlobIds = [oldUser.id, oldAssistant.id, oldTool.id, oldTail.id]
  const route = resolveProviderRuntime(parsed.modelId)
  const model = vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Synthetic summary text' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 1000, outputTokens: 20 } }
  })

  const writes = new Map<string, Buffer>()
  const session = createEphemeralSession(`synthetic-${mode}-kv`)
  session.nextCompactionBlobRequestId = 2_000_000
  const run = mode === 'manual' ? handleSummarizeAction(parsed, session) : handleConversationRun(parsed, session)
  let checkedArchive = false
  for await (const frame of run) {
    if (frame.message.case === 'kvServerMessage' && frame.message.value.message.case === 'setBlobArgs') {
      const write = readKvFrame(frame)
      writes.set(write.id, write.bytes)
      if (write.requestId >= 2_000_000)
        pushSessionMessage(session, { kvClientMessage: { id: write.requestId, setBlobResult: confirmed ? {} : { error: {} } } })
    }
    if (frame.message.case !== 'conversationCheckpointUpdate' || checkedArchive || !frame.message.value.summaryArchives.length)
      continue
    const archiveId = Buffer.from(frame.message.value.summaryArchives[0]).toString('utf8')
    const archive = fromBinary(ConversationSummaryArchiveSchema, writes.get(archiveId)!)
    for (const id of frame.message.value.rootPromptMessagesJson) {
      const bytes = writes.get(Buffer.from(id).toString('utf8'))
      expect(JSON.parse(bytes!.toString('utf8')).role).toMatch(/^(?:system|user|assistant|tool)$/)
    }
    const summaryId = Buffer.from(archive.summaryMessage!).toString('utf8')
    expect(JSON.parse(writes.get(summaryId)!.toString('utf8')).providerOptions.cursor.isSummary).toBe(true)
    const archived = archive.summarizedMessages.map((id) => {
      const bytes = writes.get(Buffer.from(id).toString('utf8'))
      return JSON.parse(bytes!.toString('utf8'))
    })
    expect(archived.find(message => message.role === 'tool').content).toEqual([
      { type: 'tool-result', toolCallId: 'call-kv', toolName: 'Read', result: 'Synthetic result' },
    ])
    checkedArchive = true
  }
  expect(checkedArchive).toBe(confirmed)
  expect(model).toHaveBeenCalledTimes(mode === 'manual' ? 1 : 2)
  expect(getCachedBlob(oldTool.id)).toBe(oldTool.data)
})
