import type { ConnectRouter, ServiceImpl } from '@connectrpc/connect'
import type { LLMStreamEvent, LLMStreamRequest } from '../handlers/llm/types'
import { fromJson } from '@bufbuild/protobuf'
import { createHandlerContext } from '@connectrpc/connect'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as checkpoints from '../database/checkpoints'
import { closeAgentDatabase, resetAgentDatabaseForTests } from '../database/sqlite'
import { AgentClientMessageSchema, AgentService } from '../gen/agent_v1_pb'
import { handleRunRequest } from '../handlers/agent/agentOrchestrator'
import { encodeBlob } from '../handlers/agent/blob'
import { cacheBlob, resetBlobCacheForTests } from '../handlers/agent/blobStore'
import { closeSession, createEphemeralSession, getOrCreateSession, pushSessionMessage } from '../handlers/agent/session'
import * as toolRuntime from '../handlers/agent/toolRuntime'
import { resolveProviderRuntime } from '../handlers/llm'
import registerAgentService from '../services/core/AgentService'

const modelId = 'gpt-5.4-medium'
const runMessage = { runRequest: {
  conversationId: 'synthetic-provider-cancellation',
  modelDetails: { modelId },
  action: { userMessageAction: { userMessage: { text: 'Continue.' }, requestContext: {} } },
} }

function waitForever<T>(): Promise<T> {
  return new Promise(() => {})
}

function hangProvider() {
  const next = vi.fn(() => waitForever<IteratorResult<LLMStreamEvent>>())
  const close = vi.fn(() => waitForever<IteratorResult<LLMStreamEvent>>())
  const stream = vi.spyOn(resolveProviderRuntime(modelId).provider, 'stream').mockReturnValue({
    [Symbol.asyncIterator]: () => ({ next, return: close }),
  })
  return { next, close, stream }
}

async function exhaust<T>(events: AsyncIterable<T>): Promise<T[]> {
  const frames: T[] = []
  for await (const frame of events)
    frames.push(frame)
  return frames
}

function agentService() {
  const service = vi.fn<(descriptor: typeof AgentService, impl: ServiceImpl<typeof AgentService>) => void>()
  registerAgentService({ service } as unknown as ConnectRouter)
  return service.mock.calls[0][1]
}

function context(method: keyof Pick<typeof AgentService.method, 'run' | 'runSSE'>) {
  return createHandlerContext({ service: AgentService, method: AgentService.method[method], protocolName: 'grpc', requestMethod: 'POST', url: 'http://localhost' })
}

beforeEach(async () => {
  await resetAgentDatabaseForTests()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await closeAgentDatabase()
  resetBlobCacheForTests()
})

it.each(['generation', 'manual summary', 'automatic summary'])('cancels a hung %s without waiting for provider cleanup or committing', async (kind) => {
  const session = createEphemeralSession(`synthetic-${kind}`)
  const { next, close, stream } = hangProvider()
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  const msg = structuredClone(runMessage)
  if (kind !== 'generation') {
    const rootPromptMessagesJson = [
      { role: 'user', content: 'Earlier user prompt.' },
      { role: 'assistant', content: 'Earlier assistant response with enough detail to summarize.' },
      { role: 'user', content: 'Earlier follow-up.' },
      { role: 'assistant', content: 'Earlier follow-up response.' },
    ].map((record) => {
      const blob = encodeBlob(record)
      cacheBlob(blob.blobId, blob.blobData)
      return Buffer.from(blob.blobId).toString('base64')
    })
    Object.assign(msg.runRequest, { conversationState: { rootPromptMessagesJson, tokenDetails: { usedTokens: 360_000, maxTokens: 400_000 } } })
    if (kind === 'manual summary') {
      Object.assign(msg.runRequest, { action: { summarizeAction: {} } })
      pushSessionMessage(session, { execClientMessage: { id: '1', executeHookResult: {} } })
    }
  }
  const run = exhaust(handleRunRequest(msg, session))
  await expect.poll(() => next.mock.calls.length).toBe(1)
  const request = stream.mock.calls[0][0]
  if (kind !== 'generation')
    expect(request.tools).toBeUndefined()
  pushSessionMessage(session, { conversationAction: { cancelAction: { reason: 'user_stopped_generation' } } })
  const frames = await run
  expect(request.signal?.aborted).toBe(true)
  expect(close).toHaveBeenCalledOnce()
  expect(commit).not.toHaveBeenCalled()
  expect(frames.some(frame => frame.message.case === 'conversationCheckpointUpdate')).toBe(false)
})

it('closes the provider while the Run request iterator stays open', async () => {
  const transport = context('run')
  const { next, close, stream } = hangProvider()
  const first = fromJson(AgentClientMessageSchema, runMessage)
  const requests = (async function* () {
    yield first
    await waitForever<void>()
  })()
  const run = exhaust(agentService().run(requests, transport))
  await expect.poll(() => next.mock.calls.length).toBe(1)
  transport.abort()
  await run
  expect(stream.mock.calls[0][0].signal?.aborted).toBe(true)
  expect(close).toHaveBeenCalledOnce()
})

it('lets Run finish generation after the client half-closes its input', async () => {
  const stream = vi.spyOn(resolveProviderRuntime(modelId).provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Reply after input closed.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 120, outputTokens: 8 } }
  })
  const requests = (async function* () {
    yield fromJson(AgentClientMessageSchema, runMessage)
  })()
  const frames = await exhaust(agentService().run(requests, context('run')))
  expect(stream).toHaveBeenCalledOnce()
  expect(frames.some(frame => frame.message?.case === 'conversationCheckpointUpdate')).toBe(true)
})

it('closes the provider when RunSSE disconnects', async () => {
  const transport = context('runSSE')
  const requestId = 'synthetic-run-sse-disconnect'
  const { next, close, stream } = hangProvider()
  const session = getOrCreateSession(requestId)
  pushSessionMessage(session, runMessage)
  try {
    const request = fromJson(AgentService.method.runSSE.input, { requestId })
    const run = exhaust(agentService().runSSE(request, transport))
    await expect.poll(() => next.mock.calls.length).toBe(1)
    transport.abort()
    await run
    expect(stream.mock.calls[0][0].signal?.aborted).toBe(true)
    expect(close).toHaveBeenCalledOnce()
  }
  finally {
    closeSession(requestId)
  }
})

it('closes upstream on early consumer return after a text frame', async () => {
  let request: LLMStreamRequest | undefined
  const close = vi.fn()
  vi.spyOn(resolveProviderRuntime(modelId).provider, 'stream').mockImplementation(async function* (streamRequest) {
    request = streamRequest
    try {
      yield { type: 'text_delta', text: 'Partial reply.' }
      await waitForever<void>()
    }
    finally {
      close()
    }
  })
  for await (const frame of handleRunRequest(runMessage)) {
    if (frame.message.case === 'interactionUpdate' && frame.message.value.message.case === 'textDelta')
      break
  }
  expect(request?.signal?.aborted).toBe(true)
  await expect.poll(() => close.mock.calls.length).toBe(1)
})

it('discards tool calls and retains usage when a response is incomplete', async () => {
  const session = createEphemeralSession('incomplete')
  const runTool = vi.spyOn(toolRuntime, 'runToolCall')
  const commit = vi.spyOn(checkpoints, 'persistConversationCheckpoint')
  const stream = vi.spyOn(resolveProviderRuntime(modelId).provider, 'stream').mockImplementation(async function* () {
    yield { type: 'text_delta', text: 'Partial reply.' }
    yield { type: 'tool_use_start', id: 'call-1', name: 'ReadFile' }
    yield { type: 'tool_use_done', id: 'call-1', arguments: '{}' }
    yield { type: 'done', stopReason: 'content_filter', usage: { inputTokens: 120, outputTokens: 8, cacheReadTokens: 40 } }
    await waitForever<void>()
  })
  const frames = await exhaust(handleRunRequest(runMessage, session))
  expect(stream).toHaveBeenCalledOnce()
  expect(runTool).not.toHaveBeenCalled()
  expect(commit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'committed' }))
  expect(frames).toContainEqual(expect.objectContaining({
    message: { case: 'interactionUpdate', value: expect.objectContaining({
      message: { case: 'turnEnded', value: expect.objectContaining({ inputTokens: 120n, outputTokens: 8n, cacheReadTokens: 40n }) },
    }) },
  }))
})
