import type { ProviderEntry, ProviderModel } from '../data/defaults'
import { ProxyAgent } from 'undici'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setProvidersForTests } from '../config/providersStore'
import { classifyTestError, detectModelProtocol, MODEL_TEST_PROMPT, runModelTest } from '../handlers/llm/modelTest'
import { resetProviderInstanceCache, resolveProviderRuntime } from '../handlers/llm/providerRuntime'
import { resolveModel } from '../handlers/models/mapper'

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init: RequestInit & { dispatcher?: unknown }) => Promise<Response>>())
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, fetch: fetchMock }
})

afterEach(() => {
  fetchMock.mockReset()
  resetProviderInstanceCache()
})

describe('classifyTestError — 让 UI 能说清下一步做什么', () => {
  it('按语义归类常见失败', () => {
    expect(classifyTestError(new Error('401 Unauthorized'))).toBe('auth')
    expect(classifyTestError(new Error('invalid api key'))).toBe('auth')
    expect(classifyTestError(new Error('429 Too Many Requests'))).toBe('rate-limit')
    expect(classifyTestError(new Error('model_not_found'))).toBe('not-found')
    expect(classifyTestError(new Error('request timed out'))).toBe('timeout')
    expect(classifyTestError(new Error('fetch failed'))).toBe('network')
    expect(classifyTestError(new Error('400 invalid_request_error'))).toBe('protocol')
    expect(classifyTestError(new Error('something odd happened'))).toBe('unknown')
  })

  it('401 不会被更宽泛的 400 规则抢先命中', () => {
    // 顺序敏感：若 400 规则排在前面，"401" 会被归成 protocol，
    // 用户就会去改请求参数，而实际要改的是 API Key。
    expect(classifyTestError(new Error('HTTP 401 from upstream'))).toBe('auth')
    expect(classifyTestError(new Error('HTTP 403 from upstream'))).toBe('auth')
  })

  it('404 与 429 各自独立归类，不互相串味', () => {
    expect(classifyTestError(new Error('HTTP 404'))).toBe('not-found')
    expect(classifyTestError(new Error('HTTP 429'))).toBe('rate-limit')
  })

  it('网络层错误的常见形态都能识别', () => {
    expect(classifyTestError(new Error('connect ECONNREFUSED 127.0.0.1:8080'))).toBe('network')
    expect(classifyTestError(new Error('getaddrinfo ENOTFOUND relay.example.com'))).toBe('network')
    expect(classifyTestError(new Error('self-signed certificate in certificate chain'))).toBe('network')
  })

  it('非 Error 输入也能处理而不是抛异常', () => {
    expect(classifyTestError('ECONNREFUSED')).toBe('network')
    expect(classifyTestError({ message: 'opaque' })).toBe('unknown')
    expect(classifyTestError(undefined)).toBe('unknown')
    expect(classifyTestError(null)).toBe('unknown')
  })
})

describe('模型测试提示词 MODEL_TEST_PROMPT —— 为测量而设计', () => {
  it('要求固定长度的输出，否则 tokens/s 没有可比性', () => {
    // 纯 "ping" 只有一两个 token，算出来的速度会被首字延迟完全淹没。
    // 这条断言是为了防止有人为了"看起来简洁"把提示词改短。
    expect(MODEL_TEST_PROMPT).toContain('1 through 120')
    expect(MODEL_TEST_PROMPT).toMatch(/no explanation/i)
  })
})

function testModel(id: string, overrides: Partial<ProviderModel> = {}): ProviderModel {
  return { id, apiModel: `upstream-${id}`, displayName: id, thinking: false, contextTokenLimit: 200_000, ...overrides }
}

const testProvider: ProviderEntry = {
  id: 'mixed-relay',
  name: 'Mixed relay',
  type: 'openai-chat',
  baseUrl: 'https://relay.invalid/gateway/v1',
  auth: { kind: 'apiKey', value: 'test-key' },
  headers: { 'x-relay': 'expected' },
  models: [],
}

function eventStream(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

const chatStream = 'data: {"choices":[{"delta":{"content":"1 2 3"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
const responsesStream = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"1 2 3"}\n\n'
  + 'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n'
const anthropicStream = [
  { type: 'message_start', message: { content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '1 2 3' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } },
  { type: 'message_stop' },
].map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

describe('custom request paths', () => {
  it.each([
    ['anthropic', 'x-api-key', 'test-key', 'messages', anthropicStream],
    ['openai-chat', 'authorization', 'Bearer test-key', 'messages', chatStream],
    ['openai-responses', 'authorization', 'Bearer test-key', 'input', responsesStream],
  ] as const)('manual tests send %s to its custom route with the codec payload and provider options', async (type, authHeader, authValue, bodyField, response) => {
    const model = testModel('custom-test', { type, customRequestPath: '/api/generate?channel=a%20b' })
    const entry = { ...testProvider, proxyUrl: 'http://proxy.invalid:8080' }
    fetchMock.mockResolvedValueOnce(eventStream(response))

    await expect(runModelTest(entry, model)).resolves.toMatchObject({ status: 'success', output: '1 2 3' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://relay.invalid/api/generate?channel=a%20b')
    expect(init.method).toBe('POST')
    expect(init.dispatcher).toBeInstanceOf(ProxyAgent)
    const headers = new Headers(init.headers)
    expect(headers.get(authHeader)).toBe(authValue)
    expect(headers.get('x-relay')).toBe('expected')
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: model.apiModel,
      stream: true,
      [bodyField]: expect.any(Array),
    })
  })

  it('explicit protocol detection uses the stock SDK route', async () => {
    const model = testModel('probe', { customRequestPath: '/api/custom' })
    fetchMock.mockResolvedValueOnce(eventStream(chatStream))

    const result = await detectModelProtocol(testProvider, model)
    expect(result.detected).toBe('openai-chat')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://relay.invalid/gateway/v1/chat/completions')
  })

  it('uses a distinct cached SDK for each live endpoint of the same codec', async () => {
    const models = [
      testModel('one', { customRequestPath: '/custom?site=one' }),
      testModel('two', { customRequestPath: '/custom?site=two' }),
      testModel('stock'),
    ]
    setProvidersForTests({ $schemaVersion: 1, providers: [{ ...testProvider, models }] })
    fetchMock.mockImplementation(async () => eventStream(chatStream))

    expect(resolveModel('one')).toMatchObject({ provider: 'openai-chat', customRequestPath: '/custom?site=one' })
    const providers = []
    for (const model of models) {
      const runtime = resolveProviderRuntime(model.id)
      providers.push(runtime.provider)
      const request = runtime.prepareStreamRequest([{ role: 'user', content: 'Test message' }]).request
      const events = []
      for await (const event of runtime.provider.stream(request))
        events.push(event)
      expect(events).toContainEqual({ type: 'text_delta', text: '1 2 3' })
    }
    expect(new Set(providers).size).toBe(3)
    expect(resolveProviderRuntime('one').provider).toBe(providers[0])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://relay.invalid/custom?site=one',
      'https://relay.invalid/custom?site=two',
      'https://relay.invalid/gateway/v1/chat/completions',
    ])
  })

  it.each([
    ['openai-chat', '//other.invalid/chat'],
    ['openai-chat', ''],
    ['openai-chat', null],
    ['gemini', '/custom'],
  ] as const)('rejects %s custom path %j before any manual or live request', async (type, path) => {
    // JSON can supply values outside the TypeScript model type.
    const model: ProviderModel = JSON.parse(JSON.stringify({ ...testModel('invalid', { type }), customRequestPath: path }))
    setProvidersForTests({ $schemaVersion: 1, providers: [{ ...testProvider, models: [model] }] })

    await expect(runModelTest(testProvider, model)).resolves.toMatchObject({ status: 'error', errorKind: 'protocol' })
    expect(() => resolveProviderRuntime(model.id)).toThrow(/custom request path/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards cancellation to the fetch for a custom live request', async () => {
    const model = testModel('abort', { customRequestPath: '/custom' })
    setProvidersForTests({ $schemaVersion: 1, providers: [{ ...testProvider, models: [model] }] })
    const runtime = resolveProviderRuntime(model.id)
    const controller = new AbortController()
    const fetchStarted = new Promise<AbortSignal>((started) => {
      fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
        const signal = init.signal!
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        started(signal)
      }))
    })

    const events = runtime.provider.stream({ model: runtime.model, messages: [{ role: 'user', content: 'Test message' }], signal: controller.signal })
    const rejected = expect(events[Symbol.asyncIterator]().next()).rejects.toThrow(/abort/i)
    const requestSignal = await fetchStarted
    controller.abort()
    expect(requestSignal.aborted).toBe(true)
    await rejected
  })
})
