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
  usesThinkingBudget?: boolean
}

export type CatalogMatch = CatalogEntry | { contextLimit?: undefined, reasoning: true, reasoningLevels: ThinkingLevel[] }

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Exact identifiers/aliases only: never prefill another model because fuzzy search ranked it first. */
export function matchCatalogModel(entries: CatalogEntry[], modelId: string, displayName = '', ownedBy = ''): CatalogMatch | undefined {
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
  else if (/^(?:deepseek\/)?deepseek-/.test(id))
    origin = 'deepseek'
  const ranked = entries.map((entry) => {
    const candidate = entry.id.toLowerCase()
    let score = 0
    if (candidate === id)
      score = 110
    else if (`${entry.providerKey}/${candidate}`.toLowerCase() === id)
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
    entry.usesThinkingBudget,
    entry.contextLevels,
    entry.supportsFast,
  ])
  const tied = ranked.filter(item => item.score === best.score).map(item => item.entry)
  if (tied.every(entry => signature(entry) === signature(best.entry)))
    return best.entry

  // Preserve only agreed reasoning capabilities when reseller limits disagree.
  if (!tied.every(entry => entry.reasoning))
    return undefined
  const declared = tied.flatMap(entry => entry.reasoningLevels?.length ? [entry.reasoningLevels] : [])
  const reasoningLevels = declared[0]?.filter(level => declared.every(levels => levels.includes(level))) ?? []
  return reasoningLevels.length ? { reasoning: true, reasoningLevels } : undefined
}

/** Defaults for a deliberate model selection; provider address, auth and wire model id are never changed. */
export function catalogModelDefaults(entry: CatalogMatch, baseUrl: string, apiModel: string, current?: Pick<ProviderModel, 'type' | 'contextTokenLimit' | 'maxOutputTokens'>): Partial<ProviderModel> {
  const full = entry.contextLimit === undefined ? undefined : entry
  const inferredType = defaultProtocolForModel(baseUrl, full?.canonicalId?.split('/').at(-1) || full?.id || apiModel)
  const type = current?.type ?? inferredType
  const contextLimit = current?.contextTokenLimit ?? full?.contextLimit
  const maxOutput = current?.maxOutputTokens ?? full?.outputLimit ?? 8192
  const maxOutputTokens = contextLimit === undefined ? maxOutput : Math.min(maxOutput, contextLimit)
  const openai = type === 'openai-chat' || type === 'openai-responses'
  let levels: ThinkingLevel[] = []
  if (entry.reasoning) {
    if (entry.reasoningLevels?.length)
      levels = entry.reasoningLevels
    else if (openai || (type === 'gemini' && !full?.usesThinkingBudget))
      levels = ['low', 'medium', 'high']
  }
  const thinkingLevel = levels.includes('medium') ? 'medium' : levels.includes('high') ? 'high' : levels[0]
  const thinkingBudgetTokens = entry.reasoning && !thinkingLevel && maxOutputTokens > 1024 ? Math.min(8192, maxOutputTokens - 1) : undefined
  const thinking = !!(thinkingLevel || thinkingBudgetTokens)
  const parameters: ProviderModel['parameters'] = {
    ...(thinking && openai && levels.length ? { reasoning: levels } : {}),
    ...(thinking && !openai ? { thinking: true, ...(levels.length ? { effort: levels } : {}) } : {}),
  }
  const thinkingDefaults = { thinking, thinkingLevel, thinkingBudgetTokens, parameters }
  if (!full || contextLimit === undefined)
    return thinkingDefaults

  const context = [...new Set([...(full.contextLevels ?? []), contextLimit])].filter(value => value > 0 && value <= contextLimit).sort((a, b) => a - b)
  return {
    type,
    noMaxTokens: false,
    displayName: full.name,
    contextTokenLimit: contextLimit,
    maxOutputTokens,
    supportsAgent: full.toolCall,
    supportsImages: full.hasImages,
    supportsCmdK: full.hasTextOutput !== false,
    fastMode: false,
    tooltipMarkdown: full.description ?? '',
    ...thinkingDefaults,
    parameters: {
      ...parameters,
      context,
      ...(full.supportsFast ? { fast: true } : {}),
    },
  }
}
