import type { LLMStreamRequest } from '../handlers/llm/types'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as checkpoints from '../database/checkpoints'
import { closeAgentDatabase, resetAgentDatabaseForTests } from '../database/sqlite'
import { decodeBlob, encodeBlob } from '../handlers/agent/blob'
import { cacheBlob, getCachedBlob, resetBlobCacheForTests } from '../handlers/agent/blobStore'
import { handleConversationRun } from '../handlers/agent/conversationRuntime'
import { parseRunRequest } from '../handlers/agent/protocol'
import { handleSummarizeAction } from '../handlers/agent/summarizeRuntime'
import * as toolRuntime from '../handlers/agent/toolRuntime'
import { resolveProviderRuntime } from '../handlers/llm'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../handlers/llm/proxyFetch', () => ({ createProxiedFetch: () => fetchMock }))

beforeEach(async () => {
  await resetAgentDatabaseForTests()
  resetBlobCacheForTests()
})

afterEach(async () => {
  vi.restoreAllMocks()
  fetchMock.mockReset()
  await closeAgentDatabase()
  resetBlobCacheForTests()
})

function response(chunks: unknown[]) {
  return new Response(`${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function fixture(action = 'background') {
  const parsed = parseRunRequest({ runRequest: {
    conversationId: 'synthetic-background-completion',
    modelDetails: { modelId: 'gpt-5.4-medium' },
    action: action === 'background'
      ? { backgroundTaskCompletionAction: { completions: [{ taskId: 'synthetic-task', kind: 2, status: 1, title: 'Synthetic completed task', detail: 'Synthetic task result.' }] } }
      : action === 'resume'
        ? { resumeAction: {} }
        : { userMessageAction: { userMessage: { text: 'Continue the synthetic task' }, requestContext: {} } },
  } })
  parsed.historyBlobIds = [
    { role: 'user', content: 'Synthetic earlier instruction.' },
    { role: 'assistant', content: 'Synthetic earlier response.' },
  ].map((message) => {
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

it('commits a silent background notification with its history instead of failing chat resumption', async () => {
  const parsed = fixture()
  const originalIds = [...parsed.historyBlobIds]
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  fetchMock.mockResolvedValue(response([
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 120, completion_tokens: 8 } },
  ]))
  const frames = await exhaust(handleConversationRun(parsed, null))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(frames.some(frame => frame.message.case === 'conversationCheckpointUpdate')).toBe(true)
  const saved = commit.mock.calls.find(([checkpoint]) => checkpoint.kind === 'committed')?.[0]
  expect(saved).toBeDefined()
  expect(saved!.rootBlobIds).toEqual(expect.arrayContaining(originalIds))
  const messages = saved!.rootBlobIds.map(id => decodeBlob(getCachedBlob(id)!))
  expect(JSON.stringify(messages)).toContain('Synthetic task result.')
  expect(JSON.stringify(messages)).not.toContain('BYOK Error')
  expect(saved!.turnBlobIds).toHaveLength(1)
})

it.each(['user', 'resume'])('does not allow a silent empty reply to a %s action', async (action) => {
  const parsed = fixture(action)
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  fetchMock.mockResolvedValue(response([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]))
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow(/LLM provider error/i)
  expect(commit.mock.calls.some(([checkpoint]) => checkpoint.kind === 'committed')).toBe(false)
})

it('preserves background history when the completion stream is interrupted', async () => {
  const parsed = fixture()
  const originalIds = [...parsed.historyBlobIds]
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  fetchMock.mockResolvedValue(response([{ choices: [{ delta: {}, finish_reason: null }] }]))
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow(/LLM provider error/i)
  expect(parsed.historyBlobIds).toEqual(originalIds)
  expect(commit.mock.calls.some(([checkpoint]) => checkpoint.kind === 'committed')).toBe(false)
})

it('keeps normal text responses to background notifications', async () => {
  const parsed = fixture()
  fetchMock.mockResolvedValue(response([{ choices: [{ delta: { content: 'Synthetic follow-up.' }, finish_reason: 'stop' }] }]))
  const frames = await exhaust(handleConversationRun(parsed, null))
  expect(frames.some(frame => frame.message.case === 'interactionUpdate'
    && frame.message.value.message.case === 'textDelta'
    && frame.message.value.message.value.text === 'Synthetic follow-up.')).toBe(true)
  expect(frames.some(frame => frame.message.case === 'conversationCheckpointUpdate')).toBe(true)
})

it('does not allow silence in tool-result rounds after the initial background notification', async () => {
  const parsed = fixture()
  const requests: LLMStreamRequest[] = []
  const provider = resolveProviderRuntime(parsed.modelId).provider
  const originalStream = provider.stream.bind(provider)
  vi.spyOn(provider, 'stream').mockImplementation((request) => {
    requests.push(structuredClone(request))
    return originalStream(request)
  })
  vi.spyOn(toolRuntime, 'runToolCall').mockImplementation(async function* ({ toolCall, roundContext, messages }) {
    const result = roundContext.createToolResult({ toolCallId: toolCall.callId, toolName: toolCall.name, content: 'Synthetic tool result.', isError: false })
    roundContext.recordToolResult(messages, result)
  })
  fetchMock.mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'synthetic-call', type: 'function', function: { name: 'ReadFile', arguments: '{"path":"synthetic.ts"}' } }] }, finish_reason: 'tool_calls' }] }]))
    .mockResolvedValueOnce(response([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]))
  await expect(exhaust(handleConversationRun(parsed, null))).rejects.toThrow(/LLM provider error/i)
  expect(requests).toHaveLength(2)
  expect(requests[0].allowEmptyCompletion).toBe(true)
  expect(requests[1].allowEmptyCompletion).not.toBe(true)
})

it('does not allow an empty summary even when the originating action is a background notification', async () => {
  const parsed = fixture()
  const originalIds = [...parsed.historyBlobIds]
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  fetchMock.mockResolvedValue(response([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]))
  await expect(exhaust(handleSummarizeAction(parsed, null))).rejects.toThrow()
  expect(parsed.historyBlobIds).toEqual(originalIds)
  expect(commit).not.toHaveBeenCalled()
})
