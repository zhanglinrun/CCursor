import type { RequestListener } from 'node:http'
import type { LLMStreamRequest } from '../handlers/llm/types'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import { AnthropicProvider } from '../handlers/llm/anthropic'
import { GeminiProvider } from '../handlers/llm/gemini'
import { OpenAIChatProvider } from '../handlers/llm/openai-chat'
import { OpenAIResponsesProvider } from '../handlers/llm/openai-responses'
import { openProviderStream } from '../handlers/llm/providerStream'

const request: LLMStreamRequest = { model: 'synthetic', messages: [{ role: 'user', content: 'Synthetic request.' }] }

afterEach(() => vi.unstubAllGlobals())

async function withRelay(handler: RequestListener, test: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a loopback address')
    await test(`http://127.0.0.1:${address.port}`)
  }
  finally {
    server.close()
    server.closeAllConnections()
  }
}

function entry<T extends 'anthropic' | 'openai-chat' | 'openai-responses' | 'gemini'>(type: T, baseUrl: string) {
  return { id: 'synthetic', name: 'Synthetic', type, baseUrl, auth: { kind: 'apiKey' as const, value: 'synthetic-key' }, models: [] }
}

const anthropicText = [
  { type: 'message_start', message: { role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Partial reply' } },
].map(event => `event: ${event.type}\n${data(event)}`).join('')
const chatText = { choices: [{ delta: { content: 'Partial reply' } }] }
const responsesText = { type: 'response.output_text.delta', delta: 'Partial reply' }
const geminiText = { candidates: [{ content: { parts: [{ text: 'Partial reply' }] } }] }

function data(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

it.each([
  { name: 'Anthropic', make: (url: string) => new AnthropicProvider(entry('anthropic', url)), first: anthropicText },
  { name: 'Anthropic beta', make: (url: string) => new AnthropicProvider(entry('anthropic', url)), first: anthropicText, betas: ['context-1m-2025-08-07'] },
  { name: 'OpenAI Chat', make: (url: string) => new OpenAIChatProvider(entry('openai-chat', `${url}/v1`)), first: data(chatText) },
  { name: 'OpenAI Responses', make: (url: string) => new OpenAIResponsesProvider(entry('openai-responses', `${url}/v1`)), first: data(responsesText) },
  { name: 'Gemini', make: (url: string) => new GeminiProvider(entry('gemini', url)), first: data(geminiText) },
])('aborts the $name SDK request at startup and during a stalled body read', async ({ make, first, betas }) => {
  for (const sendFirstEvent of [false, true]) {
    let requested = false
    let disconnected = false
    await withRelay((req, res) => {
      req.resume()
      requested = true
      res.once('close', () => {
        disconnected = true
      })
      if (sendFirstEvent) {
        res.setHeader('content-type', 'text/event-stream')
        res.write(first)
      }
    }, async (baseUrl) => {
      const cancel = new AbortController()
      const stream = openProviderStream(make(baseUrl), { ...request, anthropicBetas: betas, signal: cancel.signal })
      try {
        if (sendFirstEvent)
          await expect(stream.events.next()).resolves.toMatchObject({ value: { type: 'text_delta', text: 'Partial reply' } })
        const pending = stream.events.next()
        const aborted = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
        await expect.poll(() => requested).toBe(true)
        cancel.abort()
        await aborted
        await expect.poll(() => disconnected).toBe(true)
      }
      finally {
        stream.close()
      }
    })
  }
})

it('cancels Gemini during SDK request setup before fetch starts', async () => {
  const fetch = vi.fn(async () => new Response(null, { headers: { 'content-type': 'text/event-stream' } }))
  vi.stubGlobal('fetch', fetch)
  const cancel = new AbortController()
  const provider = new GeminiProvider(entry('gemini', 'https://relay.invalid'))
  const events = provider.stream({ ...request, signal: cancel.signal })[Symbol.asyncIterator]()
  const pending = events.next()
  cancel.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { type: 'response.incomplete', reason: 'content_filter', stopReason: 'content_filter' },
  { type: 'response.incomplete', reason: 'max_output_tokens', stopReason: 'max_tokens' },
  { type: 'response.completed', reason: 'content_filter', stopReason: 'content_filter' },
])('preserves $reason and usage on $type even with a completed tool item', async ({ type, reason, stopReason }) => {
  const item = { type: 'function_call', id: 'item-1', call_id: 'call-1', name: 'ReadFile', arguments: '{}' }
  const usage = { input_tokens: 120, output_tokens: 8, input_tokens_details: { cached_tokens: 40 } }
  await withRelay((req, res) => {
    req.resume()
    res.setHeader('content-type', 'text/event-stream')
    res.end([
      { type: 'response.output_item.added', item },
      { type: 'response.output_item.done', item },
      { type, response: { status: 'incomplete', incomplete_details: { reason }, usage } },
    ].map(data).join(''))
  }, async (url) => {
    const provider = new OpenAIResponsesProvider(entry('openai-responses', `${url}/v1`))
    const events = []
    for await (const event of provider.stream(request))
      events.push(event)
    expect(events).toEqual([
      { type: 'tool_use_start', id: 'call-1', name: 'ReadFile' },
      { type: 'tool_use_done', id: 'call-1', arguments: '{}' },
      { type: 'done', stopReason, usage: { inputTokens: 120, outputTokens: 8, cacheReadTokens: 40 } },
    ])
  })
})
