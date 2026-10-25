import type { AgentServerMessage } from '../gen/agent_v1_pb'
import type { LLMMessage, LLMToolResultBlock } from '../handlers/llm/types'
import { create, fromBinary, toBinary, toJson } from '@bufbuild/protobuf'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { closeAgentDatabase, resetAgentDatabaseForTests } from '../database/sqlite'
import { AgentClientMessageSchema, AgentServerMessageSchema } from '../gen/agent_v1_pb'
import { resetBlobCacheForTests } from '../handlers/agent/blobStore'
import { handleConversationRun } from '../handlers/agent/conversationRuntime'
import { getCursorAgentTools } from '../handlers/agent/cursorTools'
import { buildMessages, parseRunRequest } from '../handlers/agent/protocol'
import { createEphemeralSession, markSessionClosed, pushSessionMessage } from '../handlers/agent/session'
import { filterToolsForMode } from '../handlers/agent/toolkit/types'
import { runToolCall } from '../handlers/agent/toolRuntime'
import { resolveProviderRuntime } from '../handlers/llm'
import { anthropicStateStrategy } from '../handlers/llm/stateStrategy'

const input = {
  title: 'Synthetic decision',
  questions: [{ id: 'q1', prompt: 'Which synthetic option?', options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }] }],
}

beforeEach(async () => {
  await resetAgentDatabaseForTests()
  resetBlobCacheForTests()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await closeAgentDatabase()
  resetBlobCacheForTests()
})

function parsedRun(isSubagent: boolean) {
  return parseRunRequest({ runRequest: {
    conversationId: 'synthetic-subagent-question',
    modelDetails: { modelId: 'gpt-5.4-medium' },
    ...(isSubagent ? { subagentTypeName: 'synthetic-reviewer' } : {}),
    action: { userMessageAction: { userMessage: { text: 'Review the synthetic fixture.' }, requestContext: {} } },
  } })
}

function runtime(isSubagent: boolean, dynamic = false) {
  const session = createEphemeralSession('synthetic-question-runtime')
  const messages: LLMMessage[] = []
  const pendingToolResults: LLMToolResultBlock[] = []
  const roundContext = {
    createToolResult: anthropicStateStrategy.createToolResult.bind(anthropicStateStrategy),
    recordToolResult(messages: LLMMessage[], result: LLMToolResultBlock) {
      anthropicStateStrategy.addToolResult(messages, pendingToolResults, result)
    },
  }
  const iterator = runToolCall({
    toolCall: { callId: 'synthetic-question-call', name: dynamic ? 'CallDynamicTool' : 'AskQuestion', input: dynamic ? { namespace: 'cursor', toolName: 'AskQuestion', arguments: input } : input },
    availableMcpTools: [],
    cursorDynamicTools: dynamic ? [{ tool: 'AskQuestion', description: 'Synthetic question tool', inputSchema: { type: 'object' } }] : [],
    conversationId: 'synthetic-question-runtime',
    currentModelId: 'gpt-5.4-medium',
    isSubagent,
    round: 0,
    session,
    roundContext,
    messages,
    allocateExecMessageId: () => 1,
    allocateInteractionId: () => 7,
  })
  return { session, iterator, pendingToolResults }
}

function responseMessage(result: Record<string, unknown>) {
  const message = create(AgentClientMessageSchema, {
    message: { case: 'interactionResponse', value: {
      id: 7,
      result: { case: 'askQuestionInteractionResponse', value: { result } },
    } },
  } as any)
  return toJson(AgentClientMessageSchema, fromBinary(AgentClientMessageSchema, toBinary(AgentClientMessageSchema, message))) as Record<string, unknown>
}

it.each(['anthropic', 'openai-chat', 'openai-responses', 'gemini'] as const)('keeps user questions on the %s main agent, not on any subagent mode', (provider) => {
  const tools = getCursorAgentTools(provider)
  for (const mode of ['AGENT_MODE_AGENT', 'AGENT_MODE_ASK', 'AGENT_MODE_PLAN', 'AGENT_MODE_DEBUG']) {
    expect(filterToolsForMode(tools, mode).some(tool => tool.name === 'AskQuestion')).toBe(true)
    expect(filterToolsForMode(tools, mode, true).some(tool => tool.name === 'AskQuestion')).toBe(false)
  }
})

it('tells subagents to return unresolved decisions to their parent without user approval', () => {
  const child = JSON.stringify(buildMessages(parsedRun(true)))
  const main = JSON.stringify(buildMessages(parsedRun(false)))
  expect(child).toContain('Do not call AskQuestion')
  expect(child).toContain('parent agent')
  expect(child).toContain('Do not assume user approval')
  expect(main).not.toContain('Do not call AskQuestion')
})

it.each([false, true])('settles a stale subagent question without entering an interaction wait (dynamic=%s)', async (dynamic) => {
  const run = runtime(true, dynamic)
  const frames: AgentServerMessage[] = []
  try {
    for await (const frame of run.iterator) {
      frames.push(frame)
      // Old code emits the query here; fail immediately instead of waiting forever.
      expect(frame.message.case).not.toBe('interactionQuery')
      expect(frame.message.case).not.toBe('execServerMessage')
    }
  }
  finally {
    markSessionClosed(run.session)
    await run.iterator.return()
  }
  expect(frames.some(frame => frame.message.case === 'interactionUpdate' && frame.message.value.message.case === 'toolCallCompleted')).toBe(true)
  expect(run.pendingToolResults).toHaveLength(1)
  expect(run.pendingToolResults[0].isError).toBe(true)
  expect(run.pendingToolResults[0].content).toContain('parent agent')
  expect(run.pendingToolResults[0].content).toContain('Do not retry AskQuestion')
})

it.each([
  { result: { case: 'success', value: { answers: [{ questionId: 'q1', selectedOptionIds: ['b'], freeformText: '' }] } }, expected: 'success' },
  { result: { case: 'rejected', value: { reason: 'Synthetic user cancellation' } }, expected: 'rejected' },
  { result: { case: 'error', value: { errorMessage: 'Synthetic client display failure' } }, expected: 'error' },
])('keeps the main-agent question and its $expected response through real protobuf transport', async ({ result, expected }) => {
  const run = runtime(false)
  pushSessionMessage(run.session, responseMessage({ result }))
  const frames: AgentServerMessage[] = []
  for await (const frame of run.iterator)
    frames.push(fromBinary(AgentServerMessageSchema, toBinary(AgentServerMessageSchema, frame)))
  const query = frames.find(frame => frame.message.case === 'interactionQuery')
  expect(query?.message.case).toBe('interactionQuery')
  if (query?.message.case !== 'interactionQuery' || query.message.value.query.case !== 'askQuestionInteractionQuery')
    throw new Error('Expected question query')
  expect(query.message.value.query.value.toolCallId).toBe('synthetic-question-call')
  expect(query.message.value.query.value.args?.questions[0]).toMatchObject(input.questions[0])
  const completed = frames.find(frame => frame.message.case === 'interactionUpdate' && frame.message.value.message.case === 'toolCallCompleted')
  if (completed?.message.case !== 'interactionUpdate' || completed.message.value.message.case !== 'toolCallCompleted')
    throw new Error('Expected question completion')
  const tool = completed.message.value.message.value.toolCall?.tool
  if (tool?.case !== 'askQuestionToolCall')
    throw new Error('Expected question tool')
  expect(tool.value.result?.result.case).toBe(expected)
  expect(run.pendingToolResults).toHaveLength(1)
  expect(!!run.pendingToolResults[0].isError).toBe(expected !== 'success')
  expect(run.pendingToolResults[0].content).not.toContain('missing ask question response')
  if (expected === 'success')
    expect(run.pendingToolResults[0].content).toContain('"b"')
})

it('passes subagent identity to execution so a stale model question cannot suspend the conversation', async () => {
  const parsed = parsedRun(true)
  const route = resolveProviderRuntime(parsed.modelId)
  const requests: Parameters<typeof route.provider.stream>[0][] = []
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* (request) {
    requests.push(structuredClone(request))
    if (requests.length === 1) {
      yield { type: 'tool_use_start', id: 'synthetic-question-call', name: 'AskQuestion' }
      yield { type: 'tool_use_done', id: 'synthetic-question-call', arguments: JSON.stringify(input) }
      yield { type: 'done', stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 20 } }
    }
    else {
      yield { type: 'text_delta', text: 'Synthetic unresolved decision returned to parent.' }
      yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 120, outputTokens: 20 } }
    }
  })
  const session = createEphemeralSession('synthetic-subagent-conversation')
  const iterator = handleConversationRun(parsed, session)
  const frames: AgentServerMessage[] = []
  try {
    for await (const frame of iterator) {
      frames.push(frame)
      expect(frame.message.case).not.toBe('interactionQuery')
    }
  }
  finally {
    markSessionClosed(session)
  }
  expect(requests).toHaveLength(2)
  expect(requests[0].tools?.some(tool => tool.name === 'AskQuestion')).toBe(false)
  expect(JSON.stringify(requests[1].messages)).toContain('Do not retry AskQuestion')
  expect(frames.some(frame => frame.message.case === 'conversationCheckpointUpdate')).toBe(true)
})
