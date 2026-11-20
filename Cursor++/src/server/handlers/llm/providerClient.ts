import type { ProviderEntry, ProviderType } from '../../data/defaults'
import type { LLMProvider } from './types'
import { buildProviderBaseUrl, customRequestUrl, isCustomRequestType } from '../../../shared/providerProtocol'
import { AnthropicProvider } from './anthropic'
import { GeminiProvider } from './gemini'
import { OpenAIChatProvider } from './openai-chat'
import { OpenAIResponsesProvider } from './openai-responses'

export function resolveCustomRequestUrl(type: ProviderType, baseUrl: string, path: unknown): string | undefined {
  if (path === undefined)
    return undefined
  if (!isCustomRequestType(type))
    throw new Error(`Custom request paths are unsupported for the ${type} protocol.`)

  const url = customRequestUrl(baseUrl, path)
  if (!url)
    throw new Error('Invalid custom request path. Set an absolute HTTP(S) provider URL and a same-origin path starting with /.')
  return url
}

export function createProviderClient(entry: ProviderEntry, type: ProviderType, requestUrl?: string): LLMProvider {
  const effectiveEntry: ProviderEntry = {
    ...entry,
    type,
    baseUrl: requestUrl === undefined ? buildProviderBaseUrl(type, entry.baseUrl) : new URL(requestUrl).origin,
  }
  switch (type) {
    case 'anthropic': return new AnthropicProvider(effectiveEntry, requestUrl)
    case 'openai-chat': return new OpenAIChatProvider(effectiveEntry, requestUrl)
    case 'openai-responses': return new OpenAIResponsesProvider(effectiveEntry, requestUrl)
    case 'gemini': return new GeminiProvider(effectiveEntry)
  }
}
