/** models.dev metadata is only used to prefill explicitly selected models, never saved providers. */
import type { CatalogEntry } from '../../shared/catalogModelDefaults'
import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import Fuse from 'fuse.js'
import { matchCatalogModel } from '../../shared/catalogModelDefaults'
import { logger } from '../logger'
import { getModelsCatalogFilePath } from './paths'

export const CATALOG_URL = 'https://models.dev/api.json'
export const CATALOG_TIMEOUT_MS = 10_000
export const CATALOG_MAX_BYTES = 16 * 1024 * 1024

export type { CatalogEntry } from '../../shared/catalogModelDefaults'

export interface CatalogStatus {
  source: 'bundled' | 'cache' | 'remote' | 'empty'
  url: string
  modelCount: number
  providerCount: number
  /** Last successful download, not the file modification time or a model release date. */
  updatedAt?: string
  refreshing: boolean
  lastError?: string
}

interface CatalogOptions {
  cachePath: string
  bundledPath: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxBytes?: number
  now?: () => Date
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function positiveLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** Keep provider-specific copies: resellers can publish different limits for the same id. */
export function parseCatalog(raw: unknown): CatalogEntry[] {
  const root = record(raw)
  if (!root)
    throw new Error('models.dev catalog must be an object')
  const entries: CatalogEntry[] = []
  for (const [providerKey, value] of Object.entries(root)) {
    const provider = record(value)
    const models = record(provider?.models)
    if (!providerKey.trim() || !models)
      continue
    for (const [modelId, value] of Object.entries(models)) {
      const model = record(value)
      const limit = record(model?.limit)
      if (!model || !modelId.trim() || !positiveLimit(limit?.context))
        continue
      // Missing output is allowed; published invalid/zero limits are never offered as defaults.
      if (limit.output !== undefined && !positiveLimit(limit.output))
        continue
      const modalities = record(model.modalities)
      const reasoningOptions = Array.isArray(model.reasoning_options) ? model.reasoning_options : []
      const supportedLevels = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
      const levels = reasoningOptions.flatMap((option) => {
        const item = record(option)
        return item?.type === 'effort' && Array.isArray(item.values) ? item.values.filter((value): value is NonNullable<CatalogEntry['reasoningLevels']>[number] => typeof value === 'string' && supportedLevels.has(value)) : []
      })
      const cost = record(model.cost)
      const tiers = Array.isArray(cost?.tiers) ? cost.tiers : []
      const contextLevels = tiers.flatMap((value) => {
        const tier = record(record(value)?.tier)
        return tier?.type === 'context' && positiveLimit(tier.size) ? [tier.size] : []
      })
      entries.push({
        providerKey,
        providerName: text(provider?.name) ?? providerKey,
        id: text(model.id) ?? modelId,
        name: text(model.name) ?? text(model.id) ?? modelId,
        contextLimit: limit.context,
        outputLimit: positiveLimit(limit.output) ? limit.output : undefined,
        reasoning: model.reasoning === true,
        toolCall: model.tool_call === true,
        hasImages: Array.isArray(modalities?.input) && modalities.input.includes('image'),
        releaseDate: text(model.release_date),
        canonicalId: text(model.canonical_model_id),
        description: text(model.description),
        reasoningLevels: [...new Set(levels)],
        contextLevels,
        supportsFast: !!record(record(record(model.experimental)?.modes)?.fast),
        hasTextOutput: !Array.isArray(modalities?.output) || modalities.output.includes('text'),
      })
    }
  }
  if (!entries.length)
    throw new Error('models.dev catalog contains no usable models with positive token limits')
  return entries
}

function buildFuse(entries: CatalogEntry[]): Fuse<CatalogEntry> {
  return new Fuse(entries, {
    keys: [{ name: 'id', weight: 2 }, { name: 'name', weight: 1 }],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class CatalogStore {
  private entries: CatalogEntry[] = []
  private fuse = buildFuse([])
  private loaded = false
  private refreshing?: Promise<CatalogStatus>
  private status: Omit<CatalogStatus, 'refreshing'> = {
    source: 'empty',
    url: CATALOG_URL,
    modelCount: 0,
    providerCount: 0,
  }

  constructor(private readonly options: CatalogOptions) {}

  private install(entries: CatalogEntry[], index: Fuse<CatalogEntry>, source: CatalogStatus['source'], updatedAt?: string) {
    this.entries = entries
    this.fuse = index
    this.status = {
      source,
      url: CATALOG_URL,
      modelCount: entries.length,
      providerCount: new Set(entries.map(entry => entry.providerKey)).size,
      updatedAt,
    }
  }

  private load() {
    if (this.loaded)
      return
    this.loaded = true
    const errors: string[] = []
    let best: { entries: CatalogEntry[], source: 'cache' | 'bundled', updatedAt?: string } | undefined
    for (const [path, source] of [[this.options.cachePath, 'cache'], [this.options.bundledPath, 'bundled']] as const) {
      try {
        if (statSync(path).size > (this.options.maxBytes ?? CATALOG_MAX_BYTES))
          throw new Error('Catalog file exceeds size limit')
        const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
        const snapshot = record(raw)
        // Older installers saved the bare models.dev document. Continue to accept it.
        const wrapped = snapshot?.version === 1 && snapshot?.source === CATALOG_URL
        const entries = parseCatalog(wrapped ? snapshot.catalog : raw)
        const updatedAt = wrapped && typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt))
          ? new Date(snapshot.updatedAt).toISOString()
          : undefined
        // Prefer a newer packaged snapshot over a stale/legacy installer cache.
        if (!best || (updatedAt ?? '') > (best.updatedAt ?? ''))
          best = { entries, source, updatedAt }
      }
      catch (error) {
        errors.push(errorMessage(error))
      }
    }
    if (best) {
      this.install(best.entries, buildFuse(best.entries), best.source, best.updatedAt)
      return
    }
    this.status.lastError = `Catalog unavailable: ${errors.join('; ')}`
    logger.warn({ error: this.status.lastError }, '[CFG] models catalog unavailable')
  }

  getStatus(): CatalogStatus {
    this.load()
    return { ...this.status, refreshing: !!this.refreshing }
  }

  search(query: string, limit = 20): CatalogEntry[] {
    this.load()
    const count = Math.max(1, Math.min(100, Math.floor(limit) || 20))
    const entries = query.trim() ? this.fuse.search(query.slice(0, 500), { limit: count }).map(result => result.item) : [...this.entries]
    return entries.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')).slice(0, count)
  }

  match(modelId: string, displayName = '', ownedBy = ''): CatalogEntry | undefined {
    this.load()
    return matchCatalogModel(this.entries, modelId, displayName, ownedBy)
  }

  /** One shared request, deadline covers both headers and the streamed/decompressed body. */
  private async download(): Promise<string> {
    const controller = new AbortController()
    const maxBytes = this.options.maxBytes ?? CATALOG_MAX_BYTES
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('models.dev catalog request timed out'))
      }, this.options.timeoutMs ?? CATALOG_TIMEOUT_MS)
    })
    const request = async () => {
      const response = await (this.options.fetchImpl ?? fetch)(CATALOG_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
      })
      if (!response.ok)
        throw new Error(`models.dev catalog request failed (HTTP ${response.status})`)
      if (Number(response.headers.get('content-length')) > maxBytes)
        throw new Error('models.dev catalog exceeds size limit')
      if (!response.body)
        throw new Error('models.dev catalog response is empty')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break
          size += value.byteLength
          if (size > maxBytes)
            throw new Error('models.dev catalog exceeds size limit')
          chunks.push(value)
        }
        return Buffer.concat(chunks, size).toString('utf8')
      }
      finally {
        void reader.cancel().catch(() => {})
      }
    }
    try {
      return await Promise.race([request(), timeout])
    }
    finally {
      clearTimeout(timer)
      controller.abort()
    }
  }

  /** Same-directory rename commits the validated snapshot; no last-good file is ever deleted. */
  private async persist(content: string) {
    const path = this.options.cachePath
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      const file = await open(temporary, 'wx', 0o600)
      try {
        await file.writeFile(content, 'utf8')
        await file.sync()
      }
      finally {
        await file.close()
      }
      await rename(temporary, path)
    }
    finally {
      await rm(temporary, { force: true }).catch(() => {})
    }
  }

  refresh(): Promise<CatalogStatus> {
    this.load()
    if (this.refreshing)
      return this.refreshing
    this.refreshing = (async () => {
      try {
        const raw: unknown = JSON.parse(await this.download())
        const entries = parseCatalog(raw)
        const index = buildFuse(entries)
        const updatedAt = (this.options.now?.() ?? new Date()).toISOString()
        const content = JSON.stringify({ version: 1, source: CATALOG_URL, updatedAt, catalog: raw })
        if (Buffer.byteLength(content) > (this.options.maxBytes ?? CATALOG_MAX_BYTES))
          throw new Error('models.dev catalog snapshot exceeds size limit')
        await this.persist(content)
        this.install(entries, index, 'remote', updatedAt)
      }
      catch (error) {
        this.status.lastError = errorMessage(error)
        logger.warn({ error: this.status.lastError }, '[CFG] models catalog refresh failed; keeping last good catalog')
      }
      finally {
        this.refreshing = undefined
      }
      return this.getStatus()
    })()
    return this.refreshing
  }
}

// esbuild copies the single installer snapshot beside dist/extension.js for VSIX-only installs.
let store: CatalogStore | undefined
function getStore(): CatalogStore {
  store ??= new CatalogStore({
    cachePath: getModelsCatalogFilePath(),
    bundledPath: join(__dirname, 'models-catalog.json'),
  })
  return store
}

export function searchCatalog(query: string, limit = 20): CatalogEntry[] {
  return getStore().search(query, limit)
}

export function getCatalogStatus(): CatalogStatus {
  return getStore().getStatus()
}

export function refreshCatalog(): Promise<CatalogStatus> {
  return getStore().refresh()
}

export function resetCatalogCacheForTests(): void {
  store = undefined
}

export function resolveCatalogModel(modelId: string, displayName = '', ownedBy = ''): CatalogEntry | undefined {
  return getStore().match(modelId, displayName, ownedBy)
}
