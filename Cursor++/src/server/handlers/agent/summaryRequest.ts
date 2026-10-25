import type { AgentServerMessage } from '../../gen/agent_v1_pb'
import type { resolveProviderRuntime } from '../llm'
import type { LLMMessage, LLMStreamRequest } from '../llm/types'
import type { ParsedRunRequest } from './protocol'
import type { AgentSession } from './session'
import { estimateRequestTokens } from './compactionStrategy'
import { summary } from './stream'
import { buildSummaryUserMessage, SUMMARY_SYSTEM_PROMPT } from './summaryPrompt'
import { getContextBudgetLimits } from './usage'
import { throwIfSessionCancelled, waitForPromiseWithHeartbeat } from './wait'

/** 分块只改变摘要请求，不截掉原历史；所有块成功后才能提交 checkpoint。 */
export async function* generateModelSummary(params: {
  source: string
  route: ReturnType<typeof resolveProviderRuntime>
  parsed: ParsedRunRequest
  contextTokenLimit: number
  session?: AgentSession | null
}): AsyncGenerator<AgentServerMessage, string, void> {
  const { route, parsed, session } = params
  const budget = getContextBudgetLimits(params.contextTokenLimit, route.maxOutputTokens)
  const maxTokens = Math.max(1, Math.min(Math.floor(budget.requestHeadroom * 0.8), route.maxOutputTokens))
  const makeRequest = (source: string): LLMStreamRequest => {
    const messages: LLMMessage[] = [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildSummaryUserMessage(source) },
    ]
    const prepared = route.prepareStreamRequest(messages, [], maxTokens, parsed.mode, { thinking: false }, parsed.conversationId, parsed.isSubagent, parsed.clientFast, undefined, params.contextTokenLimit, [])
    return { ...prepared.request, tools: undefined, thinking: false, thinkingLevel: undefined, thinkingBudgetTokens: undefined }
  }
  const fits = (text: string) => estimateRequestTokens(makeRequest(text).messages) < budget.hardLimit
  if (!fits(''))
    throw new Error('Summary prompt exceeds the safe context budget; history preserved.')

  const chunksFor = (source: string): string[] => {
    const chunks: string[] = []
    let rest = source
    while (rest.length > 0) {
      if (fits(rest)) {
        chunks.push(rest)
        break
      }
      let low = 0
      let high = rest.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (fits(rest.slice(0, middle)))
          low = middle
        else high = middle - 1
      }
      // 不从 UTF-16 代理对中间切开。
      if (low > 0 && /[\uD800-\uDBFF]/.test(rest.charAt(low - 1)))
        low--
      if (low <= 0)
        throw new Error('Summary input cannot fit the safe context budget; history preserved.')
      chunks.push(rest.slice(0, low))
      rest = rest.slice(low)
    }
    return chunks
  }

  let source = params.source
  for (let pass = 0; pass < 4; pass++) {
    const chunks = chunksFor(source)
    if (chunks.length === 0)
      throw new Error('No conversation content to summarize; history preserved.')
    const summaries: string[] = []
    for (const chunk of chunks) {
      if (session)
        throwIfSessionCancelled(session)
      const request = makeRequest(chunk)
      const stream = route.provider.stream(request)[Symbol.asyncIterator]()
      let text = ''
      let completed = false
      try {
        while (true) {
          const next = yield* waitForPromiseWithHeartbeat(stream.next())
          if (session)
            throwIfSessionCancelled(session)
          if (next.done)
            break
          const event = next.value
          if (event.type === 'done') {
            if (event.stopReason !== 'end_turn')
              throw new Error(`Summary did not complete: ${event.stopReason}`)
            completed = true
          }
          if (event.type === 'text_delta') {
            text += event.text
            yield summary(event.text)
          }
        }
      }
      finally {
        await stream.return?.()
      }
      if (!completed || !text.trim())
        throw new Error('Model returned an empty or incomplete summary; history preserved.')
      summaries.push(text.trim())
    }
    if (summaries.length === 1)
      return summaries[0]
    const merged = summaries.map((text, index) => `Part ${index + 1}:\n${text}`).join('\n\n')
    if (estimateRequestTokens([{ role: 'user', content: merged }]) >= estimateRequestTokens([{ role: 'user', content: source }]))
      throw new Error('Chunked summaries did not reduce context; history preserved.')
    source = merged
  }
  throw new Error('Chunked summary exceeded the reduction limit; history preserved.')
}
