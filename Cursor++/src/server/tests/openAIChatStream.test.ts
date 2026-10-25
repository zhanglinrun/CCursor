import type { LLMStreamEvent, LLMStreamRequest } from '../handlers/llm/types'
import { afterEach, expect, it, vi } from 'vitest'
import { OpenAIChatProvider } from '../handlers/llm/openai-chat'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../handlers/llm/proxyFetch', () => ({ createProxiedFetch: () => fetchMock }))

afterEach(() => fetchMock.mockReset())

async function collect(chunks: unknown[], end = true, overrides: Partial<LLMStreamRequest> = {}): Promise<LLMStreamEvent[]> {
  const body = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')
    + (end ? 'data: [DONE]\n\n' : '')
  fetchMock.mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
  const provider = new OpenAIChatProvider({
    id: 'synthetic',
    name: 'Synthetic',
    type: 'openai-chat',
    baseUrl: 'https://relay.invalid/v1',
    auth: { kind: 'apiKey', value: 'synthetic-key' },
    models: [],
  })
  const events: LLMStreamEvent[] = []
  for await (const event of provider.stream({ model: 'synthetic', messages: [{ role: 'user', content: 'Non-empty synthetic request' }], ...overrides }))
    events.push(event)
  return events
}

it.each([
  { chunks: [] },
  { chunks: [{ choices: [{ delta: {}, finish_reason: 'stop' }] }] },
  { chunks: [{ choices: [{ delta: { content: '   ', tool_calls: [] }, finish_reason: 'stop' }] }] },
  { chunks: [{ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }] },
])('rejects an empty completion instead of reporting zero-usage success: %j', async ({ chunks }) => {
  await expect(collect(chunks)).rejects.toThrow(/empty|no.*content/i)
  const request = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(request.messages[0].content).toBe('Non-empty synthetic request')
})

it('accepts content without usage accounting', async () => {
  const events = await collect([
    { choices: [{ delta: { content: 'Synthetic reply' }, finish_reason: null }] },
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
  ])
  expect(events).toContainEqual({ type: 'text_delta', text: 'Synthetic reply' })
  expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'end_turn' })
})

it('rejects a stream that ends before the completion finish marker', async () => {
  await expect(collect([{ choices: [{ delta: { content: 'Partial reply' }, finish_reason: null }] }], false))
    .rejects
    .toThrow(/incomplete|finish|interrupted/i)
})

it('preserves the output-limit finish reason', async () => {
  const events = await collect([{ choices: [{ delta: { content: 'Partial reply' }, finish_reason: 'length' }] }])
  expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'max_tokens' })
})

it('accepts a tool-only completion', async () => {
  const events = await collect([
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-synthetic', type: 'function', function: { name: 'Read', arguments: '{"path":"fixture.ts"}' } }] }, finish_reason: null }] },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
  ])
  expect(events).toContainEqual({ type: 'tool_use_done', id: 'call-synthetic', arguments: '{"path":"fixture.ts"}' })
  expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'tool_use' })
})

it('completes a tool call when the final chunk omits delta', async () => {
  const events = await collect([
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-synthetic', type: 'function', function: { name: 'Read', arguments: '{}' } }] }, finish_reason: null }] },
    { choices: [{ finish_reason: 'tool_calls' }] },
  ])
  expect(events).toContainEqual({ type: 'tool_use_done', id: 'call-synthetic', arguments: '{}' })
})

it('accepts an explicitly allowed silent stop and preserves its usage without sending the local flag', async () => {
  const events = await collect([
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 120, completion_tokens: 8 } },
  ], true, { allowEmptyCompletion: true })
  expect(events).toEqual([{ type: 'done', stopReason: 'end_turn', usage: { inputTokens: 120, outputTokens: 8, cacheReadTokens: undefined } }])
  const request = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(request).not.toHaveProperty('allowEmptyCompletion')
})

it.each([
  { chunks: [] },
  { chunks: [{ choices: [{ delta: {}, finish_reason: null }] }] },
  { chunks: [{ choices: [{ delta: {}, finish_reason: 'length' }] }] },
  { chunks: [{ choices: [{ delta: {}, finish_reason: 'content_filter' }] }] },
  { chunks: [{ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }] },
  { chunks: [{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'incomplete', function: { arguments: '{}' } }] }, finish_reason: 'stop' }] }] },
])('still rejects invalid empty streams when silent completion is allowed: %j', async ({ chunks }) => {
  await expect(collect(chunks, true, { allowEmptyCompletion: true })).rejects.toThrow(/empty|incomplete|finish/i)
})
