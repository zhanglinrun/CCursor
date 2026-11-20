import type { ProviderType } from '../server/data/defaults'
import { buildProviderBaseUrl } from '../shared/providerProtocol'

export const PROVIDER_PRESETS: readonly { id: string, name: string, type: ProviderType, baseUrl: string }[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai-responses', baseUrl: buildProviderBaseUrl('openai-responses', '') },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: buildProviderBaseUrl('anthropic', '') },
  { id: 'gemini', name: 'Google Gemini', type: 'gemini', baseUrl: buildProviderBaseUrl('gemini', '') },
  { id: 'deepseek', name: 'DeepSeek', type: 'openai-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'openrouter', name: 'OpenRouter', type: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1' },
]
