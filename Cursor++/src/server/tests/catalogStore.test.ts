import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_MAX_BYTES, CATALOG_TIMEOUT_MS, CATALOG_URL, CatalogStore, parseCatalog } from '../config/catalogStore'

vi.mock('../logger', () => ({ logger: { warn: vi.fn() } }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, open: vi.fn(actual.open), rename: vi.fn(actual.rename) }
})

const updatedAt = '2026-10-25T06:00:00.000Z'
function catalog(id = 'unique-old-model', context = 128000, output: number | undefined = 8192) {
  return { official: { name: 'Official', models: { [id]: { id, name: id, limit: { context, output }, reasoning: true, tool_call: true, modalities: { input: ['text', 'image'] } } } } }
}
function snapshot(data: unknown, date = updatedAt) {
  return JSON.stringify({ version: 1, source: CATALOG_URL, updatedAt: date, catalog: data })
}

let directory: string
let cachePath: string
let bundledPath: string
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'catalog-test-'))
  cachePath = join(directory, 'user', 'models-catalog.json')
  bundledPath = join(directory, 'packaged.json')
  mkdirSync(join(directory, 'user'))
  writeFileSync(cachePath, snapshot(catalog()))
  writeFileSync(bundledPath, snapshot(catalog('bundled-model'), '2026-01-01T00:00:00.000Z'))
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(directory, { recursive: true, force: true })
})
function store(fetchImpl: typeof fetch = vi.fn<typeof fetch>(), extra = {}) {
  return new CatalogStore({ cachePath, bundledPath, fetchImpl, now: () => new Date(updatedAt), ...extra })
}

it('loads a dated cache without fetching; legacy documents remain supported', () => {
  const fetchImpl = vi.fn<typeof fetch>()
  expect(store(fetchImpl).getStatus()).toMatchObject({ source: 'cache', modelCount: 1, providerCount: 1, updatedAt, refreshing: false })
  writeFileSync(cachePath, JSON.stringify(catalog()))
  rmSync(bundledPath)
  expect(store(fetchImpl).search('unique-old')[0]).toMatchObject({ contextLimit: 128000, outputLimit: 8192, hasImages: true })
  expect(store(fetchImpl).getStatus().updatedAt).toBeUndefined()
  expect(fetchImpl).not.toHaveBeenCalled()
})

it.each(['missing', 'corrupt', 'empty', 'oversized'])('uses packaged fallback when the user cache is %s, without writing user data', (kind) => {
  if (kind === 'missing')
    rmSync(cachePath)
  else
    writeFileSync(cachePath, kind === 'corrupt' ? '{' : kind === 'empty' ? '{}' : ' '.repeat(2049))
  const before = existsSync(cachePath) ? readFileSync(cachePath, 'utf8') : undefined
  const catalogStore = store(undefined, { maxBytes: 2048 })
  expect(catalogStore.getStatus()).toMatchObject({ source: 'bundled', modelCount: 1 })
  expect(catalogStore.search('bundled')[0]?.id).toBe('bundled-model')
  expect(existsSync(cachePath) ? readFileSync(cachePath, 'utf8') : undefined).toBe(before)
})

it('chooses a newer bundle over stale/undated caches but retains a newer user refresh', () => {
  writeFileSync(bundledPath, snapshot(catalog('new-bundle'), '2026-10-26T00:00:00.000Z'))
  const before = readFileSync(cachePath, 'utf8')
  expect(store().getStatus().source).toBe('bundled')
  expect(readFileSync(cachePath, 'utf8')).toBe(before)
  writeFileSync(cachePath, JSON.stringify(catalog()))
  expect(store().getStatus().source).toBe('bundled')
  writeFileSync(cachePath, snapshot(catalog(), '2026-10-27T00:00:00.000Z'))
  expect(store().getStatus().source).toBe('cache')
})

it('handles both snapshots absent and can recover by refreshing into a missing user directory', async () => {
  rmSync(join(directory, 'user'), { recursive: true })
  rmSync(bundledPath)
  const catalogStore = store(vi.fn().mockResolvedValue(Response.json(catalog('recovered'))))
  expect(catalogStore.search('')).toEqual([])
  expect(catalogStore.getStatus().lastError).toContain('unavailable')
  expect((await catalogStore.refresh()).lastError).toBeUndefined()
  expect(catalogStore.getStatus().modelCount).toBe(1)
  expect(existsSync(cachePath)).toBe(true)
})

it('refreshes atomically, shares in-flight requests, updates counts/search and persists the successful date', async () => {
  const data = { ...catalog('fresh-model'), relay: { name: 'Relay', models: { 'fresh-model': { limit: { context: 64000, output: 4096 } } } } }
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data))
  const catalogStore = store(fetchImpl)
  expect(catalogStore.search('unique-old')).toHaveLength(1)
  const pending = catalogStore.refresh()
  expect(catalogStore.refresh()).toBe(pending)
  expect(catalogStore.getStatus().refreshing).toBe(true)
  expect(await pending).toMatchObject({ source: 'remote', modelCount: 2, providerCount: 2, updatedAt, refreshing: false })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(fetchImpl).toHaveBeenCalledWith(CATALOG_URL, expect.objectContaining({ headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' }))
  expect(catalogStore.search('unique-old')).toEqual([])
  expect(catalogStore.search('fresh').map(entry => entry.contextLimit)).toEqual([128000, 64000])
  expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toMatchObject({ source: CATALOG_URL, updatedAt, catalog: data })
  expect(readdirSync(join(directory, 'user'))).toEqual(['models-catalog.json'])
  expect(store().getStatus()).toMatchObject({ source: 'cache', modelCount: 2, updatedAt })
})

describe('last-good preservation', () => {
  it.each([
    ['network', () => Promise.reject(new Error('offline'))],
    ['HTTP', () => Promise.resolve(new Response('error', { status: 503 }))],
    ['JSON', () => Promise.resolve(new Response('{'))],
    ['schema', () => Promise.resolve(Response.json({ error: 'not a catalog' }))],
    ['empty', () => Promise.resolve(Response.json({}))],
    ['array', () => Promise.resolve(Response.json([]))],
    ['invalid limits', () => Promise.resolve(Response.json(catalog('bad', 0, -1)))],
    ['declared size', () => Promise.resolve(new Response('{}', { headers: { 'content-length': '99999999' } }))],
    ['streamed size', () => Promise.resolve(new Response(' '.repeat(4097)))],
    ['body read', () => Promise.resolve(new Response(new ReadableStream({ start(controller) { controller.error(new Error('read failed')) } })))],
  ] as const)('keeps the file and in-memory search after %s failure', async (_name, fetchImpl) => {
    const before = readFileSync(cachePath, 'utf8')
    const catalogStore = store(vi.fn(fetchImpl) as typeof fetch, { maxBytes: 4096 })
    const entries = catalogStore.search('')
    const result = await catalogStore.refresh()
    expect(result).toMatchObject({ source: 'cache', modelCount: 1, updatedAt, refreshing: false })
    expect(result.lastError).toBeTruthy()
    expect(catalogStore.search('')).toEqual(entries)
    expect(readFileSync(cachePath, 'utf8')).toBe(before)
  })

  it('bounds both a stalled fetch and a stalled body by the same deadline', async () => {
    for (const fetchImpl of [
      () => new Promise<Response>(() => {}),
      () => Promise.resolve(new Response(new ReadableStream({ start() {} }))),
    ]) {
      const catalogStore = store(vi.fn(fetchImpl), { timeoutMs: 15 })
      expect((await catalogStore.refresh()).lastError).toContain('timed out')
      expect(catalogStore.search('unique-old')).toHaveLength(1)
    }
    expect(CATALOG_TIMEOUT_MS).toBe(10000)
    expect(CATALOG_MAX_BYTES).toBe(16 * 1024 * 1024)
  })

  it.each(['writeFile', 'rename'])('keeps the prior file+cache and cleans temporary files after %s fails', async (operation) => {
    const fs = await import('node:fs/promises')
    const catalogStore = store(vi.fn().mockResolvedValue(Response.json(catalog('fresh-model'))))
    const before = readFileSync(cachePath, 'utf8')
    const entries = catalogStore.search('')
    if (operation === 'rename') {
      vi.mocked(fs.rename).mockRejectedValueOnce(new Error('rename denied'))
    }
    else {
      const { open } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
      vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
        const file = await open(...args)
        vi.spyOn(file, 'writeFile').mockRejectedValue(new Error('disk full'))
        return file
      })
    }
    expect((await catalogStore.refresh()).lastError).toBeTruthy()
    expect(catalogStore.search('')).toEqual(entries)
    expect(readFileSync(cachePath, 'utf8')).toBe(before)
    expect(readdirSync(join(directory, 'user'))).toEqual(['models-catalog.json'])
  })

  it('clears an error after a subsequent successful retry', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json(catalog('fresh-model')))
    const catalogStore = store(fetchImpl)
    expect((await catalogStore.refresh()).lastError).toBe('offline')
    expect((await catalogStore.refresh()).lastError).toBeUndefined()
    expect(catalogStore.search('fresh')).toHaveLength(1)
  })
})

it('validates positive finite token limits, object schema and provider-specific data', () => {
  for (const limit of [0, -1, Infinity, Number.NaN, '8192', 1.5]) {
    expect(() => parseCatalog(catalog('bad', limit as number))).toThrow()
    expect(() => parseCatalog(catalog('bad', 128000, limit as number))).toThrow()
  }
  for (const raw of [null, [], { official: { models: [] } }, { official: { models: { bad: [] } } }])
    expect(() => parseCatalog(raw)).toThrow()
  const entries = parseCatalog({ ...catalog('shared'), relay: { models: { shared: { limit: { context: 32000 } } } } })
  expect(entries.map(entry => [entry.providerKey, entry.contextLimit, entry.outputLimit])).toEqual([['official', 128000, 8192], ['relay', 32000, undefined]])
})

it('ships a dated, usable canonical snapshot and copies it into both build outputs', () => {
  // Resolve from the test runner project root, never from a user home.
  const asset = resolve(process.cwd(), '../installer/assets/models-catalog.json')
  const raw = JSON.parse(readFileSync(asset, 'utf8'))
  expect(raw.source).toBe(CATALOG_URL)
  expect(Number.isFinite(Date.parse(raw.updatedAt))).toBe(true)
  expect(parseCatalog(raw.catalog).length).toBeGreaterThan(1000)
  expect(readFileSync(resolve('esbuild.js'), 'utf8')).toContain('"installer", "assets", "models-catalog.json"')
  expect(readFileSync(resolve('../installer/esbuild.js'), 'utf8')).toContain('models-catalog.json')
  expect(readFileSync(resolve('../installer/src/release-defaults.js'), 'utf8')).toContain('copyAsset(MODELS_CATALOG_FILE_NAME, log);')
})
