import type { LLMStreamRequest } from '../handlers/llm/types'
import { afterEach, expect, it, vi } from 'vitest'
import { estimateRequestTokens } from '../handlers/agent/compactionStrategy'
import { parseRunRequest } from '../handlers/agent/protocol'
import { generateModelSummary } from '../handlers/agent/summaryRequest'
import { getContextBudgetLimits } from '../handlers/agent/usage'
import { resolveProviderRuntime } from '../handlers/llm'

afterEach(() => vi.restoreAllMocks())

it('chunks oversized history without dropping text, caps outputs, and preserves session identity', async () => {
  const parsed = parseRunRequest({ runRequest: {
    conversationId: 'synthetic-summary-request',
    modelDetails: { modelId: 'gpt-5.4-medium' },
    action: { userMessageAction: { userMessage: { text: 'Continue' }, requestContext: {} } },
  } })
  const route = resolveProviderRuntime(parsed.modelId)
  const requests: LLMStreamRequest[] = []
  vi.spyOn(route.provider, 'stream').mockImplementation(async function* (request) {
    requests.push(request)
    yield { type: 'text_delta', text: 'Short synthetic summary.' }
    yield { type: 'done', stopReason: 'end_turn', usage: { inputTokens: 100, outputTokens: 10 } }
  })
  const source = Array.from({ length: 6000 }, (_, i) => `item-${i} synthetic detail.`).join('\n')
  const generator = generateModelSummary({ source, route, parsed, contextTokenLimit: 16000 })
  let result = ''
  while (true) {
    const next = await generator.next()
    if (next.done) {
      result = next.value
      break
    }
  }
  const budget = getContextBudgetLimits(16000, route.maxOutputTokens)
  expect(result).toBe('Short synthetic summary.')
  expect(requests.length).toBeGreaterThan(2)
  for (const request of requests) {
    expect(estimateRequestTokens(request.messages)).toBeLessThan(budget.hardLimit)
    expect(request.maxTokens).toBeLessThanOrEqual(Math.floor(budget.requestHeadroom * 0.8))
    expect(request.tools).toBeUndefined()
    expect(request.conversationId).toBe(parsed.conversationId)
    expect(request.thinking).toBe(false)
    expect(request.thinkingLevel).toBeUndefined()
    expect(request.thinkingBudgetTokens).toBeUndefined()
  }
  const firstPass = requests.slice(0, -1).map((request) => {
    const text = request.messages[1].content as string
    return text.slice(text.indexOf('<conversation_transcript>\n') + '<conversation_transcript>\n'.length, text.indexOf('\n</conversation_transcript>'))
  }).join('')
  expect(firstPass).toBe(source)
})
