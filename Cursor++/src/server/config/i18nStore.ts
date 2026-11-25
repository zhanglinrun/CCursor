import { createHash } from 'node:crypto'
import { existsSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import { CURSOR_I18N_FILE_NAME } from '../data/defaults'
import { readJsonOrNull, withSerial, writeJsonAtomic } from './atomic'
import { getI18nFilePath } from './paths'

export interface I18nConfig {
  $schemaVersion: number
  enabled: boolean
  locale: 'zh-CN'
  custom: Record<string, string>
  disabledKeys: string[]
}

interface Dictionary {
  exact: Record<string, string>
  shortUi: Record<string, string>
  patterns: { source: string, flags: string, replacement: string }[]
}

export interface I18nStatus {
  enabled: boolean
  locale: 'zh-CN'
  hash: string
  bundledCount: number
  customCount: number
  totalCount: number
  configPath: string
  custom: Record<string, string>
  disabledKeys: string[]
}

function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, ' ')
}

function normalizeConfig(raw: Partial<I18nConfig> | null): I18nConfig {
  const custom = new Map<string, string>()
  if (raw?.custom && typeof raw.custom === 'object' && !Array.isArray(raw.custom)) {
    for (const [key, value] of Object.entries(raw.custom)) {
      const normalized = normalizeKey(key)
      if (normalized && typeof value === 'string' && value.trim())
        custom.set(normalized, value.trim())
    }
  }
  const disabledKeys = Array.isArray(raw?.disabledKeys)
    ? raw.disabledKeys.filter(key => typeof key === 'string').map(normalizeKey).filter(Boolean)
    : []
  return {
    $schemaVersion: typeof raw?.$schemaVersion === 'number' ? raw.$schemaVersion : 1,
    enabled: raw?.enabled === true,
    locale: 'zh-CN',
    custom: Object.fromEntries([...custom.keys()].sort().map(key => [key, custom.get(key)!])),
    disabledKeys: [...new Set(disabledKeys)].sort(),
  }
}

export function loadI18nConfig(): I18nConfig {
  return normalizeConfig(readJsonOrNull(getI18nFilePath()))
}

export async function ensureI18nFile(): Promise<I18nConfig> {
  const path = getI18nFilePath()
  return withSerial(path, () => {
    const config = loadI18nConfig()
    if (!existsSync(path))
      writeJsonAtomic(path, config)
    return config
  })
}

export async function updateI18nConfig(updater: (draft: I18nConfig) => void): Promise<I18nConfig> {
  const path = getI18nFilePath()
  return withSerial(path, () => {
    const raw = readJsonOrNull<Partial<I18nConfig>>(path)
    if (raw === null && existsSync(path))
      throw new Error(`Cannot update unreadable localization config: ${path}`)
    const draft = normalizeConfig(raw)
    updater(draft)
    const config = normalizeConfig(draft)
    if (JSON.stringify(raw) !== JSON.stringify(config))
      writeJsonAtomic(path, config)
    return config
  })
}

export function setI18nEnabled(enabled: boolean): Promise<I18nConfig> {
  return updateI18nConfig((draft) => {
    draft.enabled = enabled
  })
}

let bundled: Dictionary | undefined
function getBundledDictionary(): Dictionary {
  bundled ??= readJsonOrNull<Dictionary>(join(__dirname, CURSOR_I18N_FILE_NAME))
    ?? readJsonOrNull<Dictionary>(join(__dirname, '..', '..', '..', '..', 'installer', 'assets', CURSOR_I18N_FILE_NAME))
    ?? { exact: {}, shortUi: {}, patterns: [] }
  return bundled
}

function buildSnapshot(config: I18nConfig, configPath: string) {
  const { enabled, locale, custom, disabledKeys } = config
  const dictionary = getBundledDictionary()
  const exact = { ...dictionary.exact, ...custom }
  const shortUi = { ...dictionary.shortUi }
  for (const key of Object.keys(custom))
    delete shortUi[key]
  for (const key of disabledKeys) {
    delete exact[key]
    delete shortUi[key]
  }
  const basic = { enabled, locale }
  const effective = enabled
    ? { enabled: true as const, locale, exact, shortUi, patterns: dictionary.patterns, disabledKeys }
    : { enabled: false as const, locale }
  const hash = createHash('sha256').update(JSON.stringify(effective)).digest('hex').slice(0, 16)
  const status: I18nStatus = {
    ...basic,
    hash,
    bundledCount: Object.keys(dictionary.exact).length + Object.keys(dictionary.shortUi).length + dictionary.patterns.length,
    customCount: Object.keys(custom).length,
    totalCount: Object.keys(exact).length + Object.keys(shortUi).length + dictionary.patterns.length,
    configPath,
    custom,
    disabledKeys,
  }
  return { status, payload: { ...effective, hash } }
}

let snapshot: (ReturnType<typeof buildSnapshot> & { key: string }) | undefined
function getSnapshot() {
  const path = getI18nFilePath()
  const config = loadI18nConfig()
  const key = JSON.stringify([path, config])
  if (snapshot?.key !== key)
    snapshot = { key, ...buildSnapshot(config, path) }
  return snapshot
}

export function getI18nStatus(): I18nStatus {
  const status = getSnapshot().status
  return { ...status, custom: { ...status.custom }, disabledKeys: [...status.disabledKeys] }
}

export function getI18nPayload() {
  return getSnapshot().payload
}

const listeners = new Set<() => void>()
let watchedPath: string | undefined
function notifyChange(): void {
  for (const listener of listeners)
    listener()
}

export function onI18nChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function startI18nWatcher(): void {
  if (watchedPath)
    return
  watchedPath = getI18nFilePath()
  watchFile(watchedPath, { interval: 2000, persistent: false }, notifyChange)
}

export function stopI18nWatcher(): void {
  if (watchedPath)
    unwatchFile(watchedPath, notifyChange)
  watchedPath = undefined
}
