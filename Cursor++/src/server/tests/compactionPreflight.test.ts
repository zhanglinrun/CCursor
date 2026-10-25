import type { LLMMessage, LLMStreamRequest } from '../handlers/llm/types'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as checkpoints from '../database/checkpoints'
import { closeAgentDatabase, resetAgentDatabaseForTests } from '../database/sqlite'
import { encodeBlob } from '../handlers/agent/blob'
import { cacheBlob, resetBlobCacheForTests } from '../handlers/agent/blobStore'
import { handleConversationRun } from '../handlers/agent/conversationRuntime'
import { parseRunRequest } from '../handlers/agent/protocol'
import { createEphemeralSession, pushSessionMessage } from '../handlers/agent/session'
import { handleSummarizeAction } from '../handlers/agent/summarizeRuntime'
import { SUMMARY_SYSTEM_PROMPT } from '../handlers/agent/summaryPrompt'
import { readTurnBaseline } from '../handlers/agent/turnTracker'
import { getContextBudgetLimits } from '../handlers/agent/usage'
import { resolveProviderRuntime } from '../handlers/llm'

vi.mock('../handlers/agent/hookRuntime', () => ({ async* executePreCompactHook() {} }))

beforeEach(async () => {
  await resetAgentDatabaseForTests()
  resetBlobCacheForTests()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await closeAgentDatabase()
  resetBlobCacheForTests()
})

function fixture() {
  const messages: LLMMessage[] = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `Synthetic history ${i}: ${'fixture content '.repeat(250)}`,
  }))
  const parsed = parseRunRequest({ runRequest: {
    conversationId: 'synthetic-preflight',
    modelDetails: { modelId: 'gpt-5.4-medium' },
    action: { userMessageAction: { userMessage: { text: 'Keep the latest synthetic instruction' }, requestContext: {} } },
  } })
  parsed.contextTokenLimit = 128000
  parsed.historyTokenDetails = { usedTokens: 120000, maxTokens: 128000 }
  parsed.historyBlobIds = messages.map((message) => {
    const blob = encodeBlob(message)
    cacheBlob(blob.blobId, blob.blobData)
    return blob.blobId
  })
  return parsed
}

async function exhaust<T>(events: AsyncIterable<T>) {
  const frames: T[] = []
  for await (const event of events)
    frames.push(event)
  return frames
}

it('summarizes existing over-threshold history before the first normal model request', async () => {
  const parsed = fixture()
  const sentIds = new Set(parsed.historyBlobIds)
  const route = resolveProviderRuntime(parsed.modelId)
  const requests: LLMStreamRequest[] = []
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* (request) {
    requests.push(structuredClone(request))
    yield { type: 'text_delta', text: requests.length === 1 ? 'Synthetic summary of prior progress.' : 'Synthetic answer.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 1000, outputTokens: 20 } }
  })
  const frames = await exhaust(handleConversationRun(parsed, null))
  expect(requests).toHaveLength(2)
  expect(requests[0].messages[0].content).toBe(SUMMARY_SYSTEM_PROMPT)
  expect(JSON.stringify(requests[1].messages)).toContain('Previous conversation summary:')
  expect(JSON.stringify(requests[1].messages)).toContain('Keep the latest synthetic instruction')
  for (const frame of frames) {
    if (frame.message.case === 'kvServerMessage' && frame.message.value.message.case === 'setBlobArgs') {
      sentIds.add(Buffer.from(frame.message.value.message.value.blobId).toString())
    }
    if (frame.message.case === 'conversationCheckpointUpdate') {
      for (const blobId of frame.message.value.rootPromptMessagesJson)
        expect(sentIds.has(Buffer.from(blobId).toString())).toBe(true)
    }
  }
})

it('stops before a normal request when preflight summarization fails', async () => {
  const parsed = fixture()
  const original = [...parsed.historyBlobIds]
  const route = resolveProviderRuntime(parsed.modelId)
  const stream = vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    throw new Error('Synthetic relay context rejection')
  })
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow(/compaction|summary|summariz/i)
  expect(stream).toHaveBeenCalledTimes(1)
  expect(parsed.historyBlobIds).toEqual(original)
})

it.each(['throw', 'empty', 'partial', 'limited', 'unfinished'])('manual summarize preserves history for a %s response', async (mode) => {
  const parsed = fixture()
  const original = [...parsed.historyBlobIds]
  const route = resolveProviderRuntime(parsed.modelId)
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    if (mode === 'throw')
      throw new Error('Synthetic relay failure')
    yield { type: 'text_delta', text: mode === 'empty' ? '  ' : 'Partial synthetic summary' }
    if (mode === 'partial')
      throw new Error('Synthetic stream interruption')
    if (mode === 'unfinished')
      return
    yield { type: 'done', stopReason: mode === 'limited' ? 'max_tokens' : 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  await expect(exhaust(handleSummarizeAction(parsed, null))).rejects.toThrow()
  expect(parsed.historyBlobIds).toEqual(original)
  expect(commit).not.toHaveBeenCalled()
})

it('manual summarize commits a successful model summary', async () => {
  const parsed = fixture()
  const route = resolveProviderRuntime(parsed.modelId)
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Synthetic summary of prior work.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  await exhaust(handleSummarizeAction(parsed, null))
  expect(commit).toHaveBeenCalledTimes(1)
  expect(commit.mock.calls[0][0].rootBlobIds.length).toBeLessThan(parsed.historyBlobIds.length)
})

it('does not send a normal request if retained context is still above the hard limit', async () => {
  const parsed = fixture()
  parsed.historyTokenDetails!.usedTokens = 1200000
  const route = resolveProviderRuntime(parsed.modelId)
  const stream = vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Synthetic summary.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow(/still too large/i)
  expect(stream).toHaveBeenCalledTimes(1)
})

it('does not summarize history below the threshold', async () => {
  const parsed = fixture()
  parsed.historyTokenDetails!.usedTokens = 1000
  const route = resolveProviderRuntime(parsed.modelId)
  const stream = vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Synthetic answer.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  await exhaust(handleConversationRun(parsed, null))
  expect(stream).toHaveBeenCalledTimes(1)
  expect(stream.mock.calls[0][0].messages[0].content).not.toBe(SUMMARY_SYSTEM_PROMPT)
})

it('includes the live current turn in the compaction checkpoint even if the next request fails', async () => {
  const parsed = fixture()
  const route = resolveProviderRuntime(parsed.modelId)
  let calls = 0
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    if (++calls > 1)
      throw new Error('Synthetic normal request failure')
    yield { type: 'text_delta', text: 'Synthetic summary.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow()
  const saved = commit.mock.calls.find(([value]) => value.kind === 'committed')?.[0]
  expect(saved?.turnBlobIds).toHaveLength(1)
  expect(readTurnBaseline(saved!.turnBlobIds[0])?.requestId).toBeTruthy()
})

it.each(['auto', 'manual'])('does not commit a %s summary after cancellation during generation', async (mode) => {
  const parsed = fixture()
  const original = [...parsed.historyBlobIds]
  const session = createEphemeralSession('synthetic-summary-cancel')
  const route = resolveProviderRuntime(parsed.modelId)
  let streamClosed = false
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* () {
    try {
      yield { type: 'text_delta', text: 'Synthetic partial summary.' }
      pushSessionMessage(session, { conversationAction: { cancelAction: { reason: 'user_stopped_generation' } } })
      yield { type: 'text_delta', text: 'Must not be committed.' }
      yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
    }
    finally {
      streamClosed = true
    }
  })
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  await expect(exhaust(mode === 'auto' ? handleConversationRun(parsed, session) : handleSummarizeAction(parsed, session)))
    .rejects
    .toThrow(/cancel/i)
  expect(streamClosed).toBe(true)
  expect(commit).not.toHaveBeenCalled()
  expect(parsed.historyBlobIds).toEqual(original)
})

it('continues below the hard limit after a soft-threshold summary failure', async () => {
  const parsed = fixture()
  const route = resolveProviderRuntime(parsed.modelId)
  const budget = getContextBudgetLimits(parsed.contextTokenLimit!, route.maxOutputTokens)
  parsed.historyTokenDetails!.usedTokens = budget.autoCompactThreshold
  const original = [...parsed.historyBlobIds]
  const requests: LLMStreamRequest[] = []
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* (request) {
    requests.push(request)
    if (requests.length === 1)
      throw new Error('Synthetic temporary summary failure')
    yield { type: 'text_delta', text: 'Continue original history.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  await exhaust(handleConversationRun(parsed, null))
  expect(requests).toHaveLength(2)
  expect(requests[0].messages[0].content).toBe(SUMMARY_SYSTEM_PROMPT)
  expect(JSON.stringify(requests[1].messages)).not.toContain('Previous conversation summary:')
  expect(parsed.historyBlobIds).toEqual(original)
})

it('uses the 1M soft threshold instead of waiting until 960K', async () => {
  const parsed = fixture()
  parsed.contextTokenLimit = 1000000
  parsed.historyTokenDetails = { usedTokens: 900000, maxTokens: 1000000 }
  const route = resolveProviderRuntime(parsed.modelId)
  const requests: LLMStreamRequest[] = []
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* (request) {
    requests.push(request)
    yield { type: 'text_delta', text: 'Synthetic result.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 20 } }
  })
  await exhaust(handleConversationRun(parsed, null))
  expect(requests).toHaveLength(2)
  expect(requests[0].messages[0].content).toBe(SUMMARY_SYSTEM_PROMPT)
})
