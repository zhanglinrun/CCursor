import type { Alpine } from 'alpinejs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const postMessage = vi.fn()
let store: any
let receive: (event: { data: any }) => void
beforeEach(async () => {
  vi.resetModules()
  postMessage.mockClear()
  vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage }))
  vi.stubGlobal('window', { addEventListener: (_type: string, callback: typeof receive) => {
    receive = callback
  } })
  vi.stubGlobal('document', { activeElement: null })
  vi.stubGlobal('HTMLInputElement', class {})
  const alpine = { store: (_name: string, value?: any) => {
    if (value)
      store = value
    return store
  } }
  const { initApp } = await import('../../ui/webview/app')
  initApp(alpine as unknown as Alpine)
  store.state = { providers: [{ id: 'provider', type: 'anthropic', baseUrl: 'https://relay.invalid', auth: { value: 'synthetic' }, models: [] }] }
})
afterEach(() => vi.unstubAllGlobals())

const entry = {
  id: 'gpt-6.1-sol',
  providerKey: 'openai',
  providerName: 'OpenAI',
  name: 'GPT-6.1 Sol',
  contextLimit: 1050000,
  outputLimit: 128000,
  reasoning: true,
  toolCall: true,
  hasImages: true,
  reasoningLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  contextLevels: [272000],
  supportsFast: true,
}
function model() {
  return store.drafts.provider.models[0]
}

it('fills the entire card on a single available-model selection without a catalog picker or saving', () => {
  store.applyRemoteModel('provider', { id: 'gpt-6.1-sol', displayName: '', ownedBy: '', createdAt: 0, catalog: entry })
  expect(model()).toMatchObject({
    apiModel: 'gpt-6.1-sol',
    displayName: 'GPT-6.1 Sol',
    type: 'openai-chat',
    maxOutputTokens: 128000,
    contextTokenLimit: 1050000,
    thinking: true,
    thinkingLevel: 'medium',
    supportsAgent: true,
    supportsImages: true,
    supportsCmdK: true,
    fastMode: false,
    parameters: { reasoning: ['low', 'medium', 'high', 'xhigh', 'max'], context: [272000, 1050000], fast: true },
  })
  expect(store.ac).toBeUndefined()
  expect(postMessage.mock.calls.some(([msg]) => msg.type === 'saveProviders' || msg.type === 'searchCatalog')).toBe(false)
})

it('keeps relay aliases and readable names instead of replacing the wire id with a catalog id', () => {
  store.applyRemoteModel('provider', { id: 'relay-private-id', displayName: 'My GPT', catalog: { ...entry, canonicalId: 'openai/gpt-6.1-sol' } })
  expect(model()).toMatchObject({ apiModel: 'relay-private-id', displayName: 'My GPT', maxOutputTokens: 128000, type: 'openai-chat' })
})

it('resolves missing metadata in the host and protects edits made during the response', () => {
  store.applyRemoteModel('provider', { id: 'gpt-6.1-sol', displayName: '', ownedBy: '', createdAt: 0 })
  const requestId = postMessage.mock.calls.find(([msg]) => msg.type === 'resolveCatalogModel')![0].requestId
  store.updateModelNumber('provider', model().id, 'maxOutputTokens', '2048')
  receive({ data: { type: 'catalogModelResolved', requestId, entry } })
  expect(model()).toMatchObject({ maxOutputTokens: 2048, contextTokenLimit: 1050000, type: 'openai-chat' })
  expect(postMessage.mock.calls.some(([msg]) => msg.type === 'searchCatalog')).toBe(false)
})

it('ignores stale results after changing or deleting the selected model', () => {
  store.applyRemoteModel('provider', { id: 'gpt-6.1-sol', displayName: '' })
  const requestId = postMessage.mock.calls.find(([msg]) => msg.type === 'resolveCatalogModel')![0].requestId
  model().apiModel = 'different-model'
  receive({ data: { type: 'catalogModelResolved', requestId, entry } })
  expect(model().contextTokenLimit).toBeUndefined()
  expect(model().apiModel).toBe('different-model')
})

it('prefills a deliberate model change on a saved row without modifying the saved provider', () => {
  store.state.providers[0].models = [{ id: 'saved', apiModel: 'old-model', displayName: 'Old', contextTokenLimit: 8000 }]
  store.ensureDraft('provider')
  model().apiModel = 'gpt-6.1-sol'
  store.syncModelId('provider', 'saved')
  const requestId = postMessage.mock.calls.find(([msg]) => msg.type === 'resolveCatalogModel')![0].requestId
  receive({ data: { type: 'catalogModelResolved', requestId, entry } })
  expect(model()).toMatchObject({ contextTokenLimit: 1050000, parameters: { context: [272000, 1050000] } })
  expect(store.state.providers[0].models[0].contextTokenLimit).toBe(8000)
})

it('refreshes directory status without touching model drafts or opening a secondary picker', () => {
  store.addModel('provider')
  const before = JSON.stringify(store.drafts)
  const status = { source: 'bundled', modelCount: 1234, providerCount: 20, updatedAt: '2026-10-25T10:00:00Z' }
  receive({ data: { type: 'catalogStatus', status } })
  expect(store.catalogSummary).toBe('1,234 个模型 · 20 个服务商')
  expect(store.catalogSummary).toContain('1,234')
  expect(store.catalogSourceLabel).toBe('内置快照')
  store.refreshCatalog()
  store.refreshCatalog()
  expect(postMessage.mock.calls.filter(([msg]) => msg.type === 'refreshCatalog')).toHaveLength(1)
  receive({ data: { type: 'catalogStatus', status: { ...status, source: 'remote', refreshing: false }, refreshed: true } })
  expect(store.catalogBusy).toBe(false)
  expect(store.catalogSourceLabel).toBe('已更新')
  expect(JSON.stringify(store.drafts)).toBe(before)
})

it('discards an earlier lookup when the same row has a newer lookup', () => {
  store.addModel('provider')
  model().apiModel = 'gpt-6.1-sol'
  store.resolveModelDefaults('provider', model().id)
  const first = postMessage.mock.calls.at(-1)![0].requestId
  store.resolveModelDefaults('provider', model().id)
  const second = postMessage.mock.calls.at(-1)![0].requestId
  receive({ data: { type: 'catalogModelResolved', requestId: first, entry } })
  expect(model().contextTokenLimit).toBeUndefined()
  receive({ data: { type: 'catalogModelResolved', requestId: second, entry } })
  expect(model().contextTokenLimit).toBe(1050000)
})

it('uses Chinese labels for directory and update states', () => {
  expect(store.catalogSummary).toBe('正在读取模型目录…')
  expect(store.catalogSourceLabel).toBe('读取中')
  expect(store.catalogUpdatedAt).toBe('暂无更新时间')
  expect(store.updateButtonLabel).toBe('检查扩展更新')
  store.updatePhase = 'checking'
  expect(store.updateButtonLabel).toBe('检查中…')
  store.updatePhase = 'installing'
  store.updateTargetVersion = '0.2.0'
  expect(store.updateButtonLabel).toBe('正在更新至 0.2.0…')
})
