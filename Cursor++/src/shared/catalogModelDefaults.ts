import type { ProviderModel, ThinkingLevel } from '../server/data/defaults'
import { defaultProtocolForModel } from './providerProtocol'

export interface CatalogEntry {
  providerKey: string
  providerName: string
  id: string
  name: string
  contextLimit: number
  outputLimit?: number
  reasoning: boolean
  toolCall: boolean
  hasImages: boolean
  releaseDate?: string
  canonicalId?: string
  description?: string
  reasoningLevels?: ThinkingLevel[]
  contextLevels?: number[]
  supportsFast?: boolean
  hasTextOutput?: boolean
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Exact identifiers/aliases only: never prefill another model because fuzzy search ranked it first. */
export function matchCatalogModel(entries: CatalogEntry[], modelId: string, displayName = '', ownedBy = ''): CatalogEntry | undefined {
  const id = modelId.trim().toLowerCase()
  if (!id)
    return undefined
  const owner = normalized(ownedBy)
  let origin = ''
  if (/^(?:openai\/)?(?:gpt-|o[1-9])/.test(id))
    origin = 'openai'
  else if (/^(?:anthropic\/)?claude-/.test(id))
    origin = 'anthropic'
  else if (/^(?:google\/)?gemini-/.test(id))
    origin = 'google'
  const ranked = entries.map((entry) => {
    const candidate = entry.id.toLowerCase()
    let score = 0
    if (candidate === id || `${entry.providerKey}/${candidate}`.toLowerCase() === id)
      score = 100
    else if (entry.canonicalId?.toLowerCase() === id)
      score = 90
    else if (normalized(candidate) === normalized(id))
      score = 80
    else if (normalized(entry.name) === normalized(id))
      score = 70
    else if (displayName && normalized(entry.name) === normalized(displayName))
      score = 60
    if (score && origin === entry.providerKey)
      score += 8
    if (score && owner && (owner === normalized(entry.providerKey) || owner === normalized(entry.providerName)))
      score += 4
    return { entry, score }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.entry.providerKey.localeCompare(b.entry.providerKey))
  const best = ranked[0]
  if (!best)
    return undefined
  // Equal-identity resellers with conflicting defaults are not a safe automatic choice.
  const signature = (entry: CatalogEntry) => JSON.stringify([
    entry.contextLimit,
    entry.outputLimit,
    entry.reasoning,
    entry.toolCall,
    entry.hasImages,
    entry.reasoningLevels,
    entry.contextLevels,
    entry.supportsFast,
  ])
  const ambiguous = ranked.some(item => item.score === best.score && signature(item.entry) !== signature(best.entry))
  return ambiguous ? undefined : best.entry
}

/** Defaults for a deliberate model selection; provider address, auth and wire model id are never changed. */
export function catalogModelDefaults(entry: CatalogEntry, baseUrl: string, apiModel: string): Partial<ProviderModel> {
  const type = defaultProtocolForModel(baseUrl, entry.canonicalId?.split('/').at(-1) || entry.id || apiModel)
  const openai = type === 'openai-chat' || type === 'openai-responses'
  let levels: ThinkingLevel[] = []
  if (entry.reasoning) {
    if (entry.reasoningLevels?.length)
      levels = entry.reasoningLevels
    else if (type === 'gemini' || openai)
      levels = ['low', 'medium', 'high']
  }
  const thinkingLevel = levels.includes('medium') ? 'medium' : levels.includes('high') ? 'high' : levels[0]
  const maxOutputTokens = Math.min(entry.outputLimit ?? 8192, entry.contextLimit)
  const context = [...new Set([...(entry.contextLevels ?? []), entry.contextLimit])].filter(value => value > 0 && value <= entry.contextLimit).sort((a, b) => a - b)
  const thinkingBudgetTokens = entry.reasoning && !thinkingLevel && maxOutputTokens > 1024 ? Math.min(8192, maxOutputTokens - 1) : undefined
  const thinking = entry.reasoning && !!(thinkingLevel || thinkingBudgetTokens)
  return {
    type,
    noMaxTokens: false,
    displayName: entry.name,
    contextTokenLimit: entry.contextLimit,
    maxOutputTokens,
    supportsAgent: entry.toolCall,
    supportsImages: entry.hasImages,
    supportsCmdK: entry.hasTextOutput !== false,
    thinking,
    ...(thinkingLevel && thinking ? { thinkingLevel } : {}),
    ...(thinkingBudgetTokens ? { thinkingBudgetTokens } : {}),
    fastMode: false,
    tooltipMarkdown: entry.description ?? '',
    parameters: {
      context,
      ...(thinking && openai && levels.length ? { reasoning: levels } : {}),
      ...(thinking && !openai ? { thinking: true, ...(levels.length ? { effort: levels } : {}) } : {}),
      ...(entry.supportsFast ? { fast: true } : {}),
    },
  }
}
