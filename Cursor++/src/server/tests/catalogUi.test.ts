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

it('saves dictionary edits without losing the current rules or a failed draft', () => {
  store.state.i18n = { custom: { About: '关于' }, disabledKeys: ['Rules'] }
  store.i18nSource = ' New  Agent '
  store.i18nTranslation = ' 新建助手 '
  store.addCustomTranslation()
  expect(postMessage).toHaveBeenLastCalledWith({
    type: 'saveLocalizationRules',
    rules: { custom: { 'About': '关于', 'New Agent': '新建助手' }, disabledKeys: ['Rules'] },
  })
  const pendingCount = postMessage.mock.calls.length
  store.removeCustomTranslation('About')
  expect(postMessage.mock.calls).toHaveLength(pendingCount)
  receive({ data: { type: 'saveLocalizationRulesResult', error: 'write failed' } })
  expect(store.i18nSource).toBe(' New  Agent ')
  expect(store.i18nRulesSaving).toBe('')
  store.addCustomTranslation()
  receive({ data: { type: 'saveLocalizationRulesResult' } })
  expect(store.i18nSource).toBe('')
  expect(store.i18nTranslation).toBe('')

  store.i18nKeepEnglish = ' Agent '
  store.addEnglishRule()
  expect(postMessage).toHaveBeenLastCalledWith({
    type: 'saveLocalizationRules',
    rules: { custom: { About: '关于' }, disabledKeys: ['Rules', 'Agent'] },
  })
  receive({ data: { type: 'saveLocalizationRulesResult' } })
  expect(store.i18nKeepEnglish).toBe('')
  store.removeEnglishRule('Rules')
  expect(postMessage).toHaveBeenLastCalledWith({
    type: 'saveLocalizationRules',
    rules: { custom: { About: '关于' }, disabledKeys: [] },
  })
})

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

it('keeps the chosen strength when async catalog defaults use a different strength', () => {
  store.applyRemoteModel('provider', { id: 'gpt-6.1-sol', displayName: '' })
  const { requestId } = postMessage.mock.lastCall![0]
  store.updateModelField('provider', model().id, 'thinking', true)
  store.updateModelField('provider', model().id, 'thinkingLevel', 'high')
  store.setEditParam('provider', model().id, 'reasoning', ['high', 'max'])
  receive({ data: { type: 'catalogModelResolved', requestId, entry } })
  expect(model()).toMatchObject({ thinking: true, thinkingLevel: 'high', contextTokenLimit: 1050000, parameters: { reasoning: ['high', 'max'] } })
})

it('imports a new relay model with its endpoint limits before the catalog knows it', () => {
  store.applyRemoteModel('provider', { id: 'private-model', displayName: 'Private', contextTokenLimit: 32000, maxOutputTokens: 2048 })
  const requestId = postMessage.mock.calls.find(([msg]) => msg.type === 'resolveCatalogModel')![0].requestId
  receive({ data: { type: 'catalogModelResolved', requestId } })
  expect(model()).toMatchObject({ apiModel: 'private-model', displayName: 'Private', contextTokenLimit: 32000, maxOutputTokens: 2048 })
  expect(store.state.providers[0].models).toEqual([])
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
  expect(store.updateButtonLabel).toBe('检查更新')
  store.updatePhase = 'checking'
  expect(store.updateButtonLabel).toBe('检查中…')
  store.updatePhase = 'installing'
  store.updateTargetVersion = '0.2.0'
  expect(store.updateButtonLabel).toBe('正在更新至 0.2.0…')
})

it('filters fetched models by display name or endpoint ID without changing the list', () => {
  store.fetchRemoteModels('provider')
  receive({ data: {
    type: 'remoteModelsResult',
    pid: 'provider',
    requestId: postMessage.mock.lastCall![0].requestId,
    models: [{ id: 'relay-sol', displayName: 'GPT Sol' }, { id: 'claude-opus', displayName: 'Claude Opus' }],
  } })
  expect(store.filteredRemoteModels('provider', ' gpt sol ')).toMatchObject([{ id: 'relay-sol' }])
  expect(store.filteredRemoteModels('provider', 'CLAUDE-OPUS')).toMatchObject([{ id: 'claude-opus' }])
  expect(store.filteredRemoteModels('provider', 'missing')).toEqual([])
  expect(store.filteredRemoteModels('provider', '')).toHaveLength(2)
})

it('keeps other drafts out of ordering and deletion updates', () => {
  store.state.providers[0].name = '已保存名称'
  store.state.providers.push({ ...store.state.providers[0], id: 'other', name: '另一个' })
  store.updateField('provider', 'name', '未保存名称')
  store.moveProvider('other', -1)
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'saveProviders',
    providers: [{ id: 'other', name: '另一个' }, { id: 'provider', name: '已保存名称' }].map(row => expect.objectContaining(row)),
  }))
  store.deleteProvider('other')
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'saveProviders',
    providers: [expect.objectContaining({ id: 'provider', name: '已保存名称' })],
  }))
  expect(store.getDraft('provider').name).toBe('未保存名称')
})

it('keeps invalid custom headers as an unsaved edit and blocks saving', () => {
  store.state.providers[0].name = '中转站'
  store.state.providers[0].auth.kind = 'apiKey'
  store.updateHeaders('provider', '[]')
  expect(store.isDirty('provider')).toBe(true)
  store.saveProvider('provider')
  expect(postMessage.mock.calls.some(([message]) => message.type === 'saveProviders')).toBe(false)
  store.resetProvider('provider')
  expect(store.isDirty('provider')).toBe(false)
})

it('uses confirmed 7-day statistics and includes cache writes in daily input counts', () => {
  const day = { date: '2026-11-20', promptTokens: 1000, cacheReadTokens: 600, cacheWriteTokens: 300, nonCachedInputTokens: 100, outputTokens: 20, calls: 1, cacheHitRate: 6 / 7 }
  store.loadUsageStats(7)
  const request = postMessage.mock.lastCall![0]
  expect(request).toMatchObject({ type: 'loadUsageStats', windowDays: 7 })
  receive({ data: { type: 'usageStats', requestId: 'older', summary: { windowDays: 14 } } })
  expect(store.usageStats).toBeNull()
  receive({ data: { type: 'usageStats', requestId: request.requestId, summary: { windowDays: 7, byDay: [day] } } })
  expect(store.usageColumnHeight(day)).toBe(100)
  expect(store.usageCacheShare(day, day.cacheWriteTokens)).toBe(30)
  expect(store.usageDayLabel(day)).toContain('输入 Token 1,000，缓存读取 600，缓存写入 300，其他输入 100')
  store.loadUsageStats()
  expect(postMessage.mock.lastCall![0]).toMatchObject({ windowDays: 7 })
})

it('imports distinct IDs into the draft and keeps endpoint limits ahead of catalog defaults', () => {
  store.state.providers[0].models = [{ id: 'existing', apiModel: 'already', displayName: '已有配置', contextTokenLimit: 8000, maxOutputTokens: 2000 }]
  store.fetchRemoteModels('provider')
  receive({ data: {
    type: 'remoteModelsResult',
    pid: 'provider',
    requestId: postMessage.mock.lastCall![0].requestId,
    models: [{ id: 'relay-sol', displayName: '自定义 Sol', catalog: entry, contextTokenLimit: 64000, maxOutputTokens: 4096 }],
  } })
  store.importModels('provider', ['already', ' relay-sol ', 'relay-sol', ''])
  const draft = store.getDraft('provider')
  expect(draft.models).toHaveLength(2)
  expect(draft.models[0]).toMatchObject({ id: 'existing', contextTokenLimit: 8000 })
  expect(draft.models[1]).toMatchObject({ apiModel: 'relay-sol', displayName: '自定义 Sol', contextTokenLimit: 64000, maxOutputTokens: 4096, defaultOn: true })
  expect(store.importReview('provider').ready).toHaveLength(1)
  expect(store.modelExpanded.provider?.[draft.models[1].id]).toBeFalsy()
  expect(store.state.providers[0].models).toHaveLength(1)
})

it('waits for imported metadata, locates missing parameters, and saves the batch explicitly', async () => {
  store.state.providers[0].name = '预览服务商'
  store.state.providers[0].auth.kind = 'apiKey'
  store.importModels('provider', ['unknown-relay-model'])
  const lookup = postMessage.mock.lastCall![0]
  expect(lookup).toMatchObject({ type: 'resolveCatalogModel', modelId: 'unknown-relay-model' })
  expect(store.importReview('provider').pending).toHaveLength(1)
  store.saveProvider('provider')
  expect(postMessage.mock.calls.some(([msg]) => msg.type === 'saveProviders')).toBe(false)

  receive({ data: { type: 'catalogModelResolved', requestId: lookup.requestId } })
  const missing = store.importReview('provider').needs[0]
  expect(missing.apiModel).toBe('unknown-relay-model')
  store.openImportedModel('provider', missing.id)
  expect(store.modelExpanded.provider[missing.id]).toBe(true)
  store.updateModelNumber('provider', missing.id, 'contextTokenLimit', '32000')
  store.updateModelNumber('provider', missing.id, 'maxOutputTokens', '2048')
  const test = vi.spyOn(store, '_runTestAndWait').mockResolvedValue(undefined)
  await store.testAllModels('provider', true)
  expect(test.mock.calls).toEqual([['provider', missing.id]])

  store.saveProvider('provider')
  const save = postMessage.mock.lastCall![0]
  expect(save).toMatchObject({ type: 'saveProviders', providers: [{ models: [{ apiModel: 'unknown-relay-model' }] }] })
  receive({ data: { type: 'saveProvidersResult', requestId: save.requestId, ok: true, state: { providers: save.providers } } })
  expect(store.importReview('provider').models).toEqual([])
})

it('saves and reloads reasoning defaults after pasting a model with conflicting catalog limits', () => {
  const provider = store.state.providers[0]
  provider.name = '预览服务商'
  provider.auth.kind = 'apiKey'
  store.importModels('provider', ['relay-reasoner'])
  const { requestId } = postMessage.mock.lastCall![0]
  receive({ data: { type: 'catalogModelResolved', requestId, entry: { reasoning: true, reasoningLevels: ['high', 'max'] } } })
  expect(model().contextTokenLimit).toBeUndefined()
  expect(model().maxOutputTokens).toBeUndefined()
  const thinking = { thinking: true, thinkingLevel: 'high', parameters: { thinking: true, effort: ['high', 'max'] } }
  expect(model()).toMatchObject(thinking)
  store.updateModelNumber('provider', model().id, 'contextTokenLimit', '64000')
  store.updateModelNumber('provider', model().id, 'maxOutputTokens', '8192')
  store.saveProvider('provider')
  const save = postMessage.mock.lastCall![0]
  expect(save).toMatchObject({ type: 'saveProviders', providers: [{ models: [thinking] }] })
  receive({ data: { type: 'saveProvidersResult', requestId: save.requestId, ok: true, state: { providers: save.providers } } })
  expect(store.getDraft('provider').models[0]).toMatchObject(thinking)
})

it('selects and clears only the visible results, preserving earlier selections', () => {
  const matches = ['visible-one', 'visible-two']
  const selected = store.toggleVisibleModels(matches, ['hidden', 'visible-one'])
  expect(selected).toEqual(['hidden', 'visible-one', 'visible-two'])
  expect(store.toggleVisibleModels(matches, selected)).toEqual(['hidden'])
})

it('applies a first-party preset to a blank draft without fetching or rewriting a connection', () => {
  store.addProvider()
  const draft = store.providers.at(-1)
  store.updateField(draft.id, 'name', '我的服务商')
  expect(store.canApplyProviderPreset(draft.id)).toBe(true)
  store.applyProviderPreset(draft.id, 'gemini')
  expect(draft).toMatchObject({ name: '我的服务商', baseUrl: 'https://generativelanguage.googleapis.com', type: 'gemini', auth: { kind: 'apiKey', value: '' } })
  expect(postMessage.mock.calls.some(([msg]) => msg.type === 'fetchRemoteModels')).toBe(false)
  store.updateField(draft.id, 'auth.value', 'fixture')
  expect(store.applyProviderPreset(draft.id, 'openai')).toBe(false)
  expect(draft).toMatchObject({ type: 'gemini', auth: { value: 'fixture' } })
})

it.each([
  ['deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', 'deepseek-v4-pro'],
  ['openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'anthropic/claude-sonnet-4.6'],
])('uses Chat Completions for models on the %s preset', (preset, name, baseUrl, id) => {
  store.addProvider()
  const draft = store.providers.at(-1)
  expect(store.applyProviderPreset(draft.id, preset)).toBe(true)
  expect(draft).toMatchObject({ name, baseUrl, type: 'openai-chat' })
  store.importModels(draft.id, [id])
  expect(store.modelRequestUrlPreview(draft.id, draft.models[0].id)).toBe(`${baseUrl}/chat/completions`)
})

it('ignores old model responses after connection details change', () => {
  store.fetchRemoteModels('provider')
  const oldRequest = postMessage.mock.lastCall![0].requestId
  store.updateField('provider', 'baseUrl', 'https://new.example.invalid')
  expect(store.remoteModels.provider).toBeUndefined()
  store.fetchRemoteModels('provider', 'gemini')
  const current = postMessage.mock.lastCall![0]
  expect(current).toMatchObject({ protocol: 'gemini', draft: { baseUrl: 'https://new.example.invalid' } })
  receive({ data: { type: 'remoteModelsResult', pid: 'provider', requestId: oldRequest, models: [{ id: 'old' }] } })
  expect(store.remoteModels.provider).toMatchObject({ loading: true, requestId: current.requestId })
  receive({ data: { type: 'remoteModelsResult', pid: 'provider', requestId: current.requestId, models: [{ id: 'new' }] } })
  expect(store.filteredRemoteModels('provider', '')).toEqual([{ id: 'new' }])
})

it('confirms batch removal once and keeps saved models intact until explicitly saved', () => {
  const models = ['one', 'two', 'keep'].map(id => ({ id, apiModel: id, displayName: id }))
  store.state.providers[0].models = models
  store.requestRemoveModels('provider', ['one', 'two', 'one', 'missing'])
  expect(store.confirmDialog).toMatchObject({ title: '删除 2 个模型', modelIds: ['one', 'two'] })
  store.cancelConfirm()
  expect(store.getDraft('provider').models).toEqual(models)

  store.requestRemoveModels('provider', ['one', 'two'])
  store.confirmAction()
  expect(store.getDraft('provider').models.map((model: { id: string }) => model.id)).toEqual(['keep'])
  expect(store.isDirty('provider')).toBe(true)
  store.getDraft('provider').models[0].displayName = 'modified draft'
  expect(store.state.providers[0].models).toEqual(models)
  expect(models[2].displayName).toBe('keep')
  expect(postMessage.mock.calls.some(([message]) => message.type === 'saveProviders')).toBe(false)
  store.resetProvider('provider')
  expect(store.getDraft('provider').models).toEqual(models)
})

it('keeps native and custom request paths together when editing and saving a service', () => {
  const provider = store.state.providers[0]
  provider.name = '预览服务'
  provider.auth.kind = 'apiKey'
  provider.models = ['native', 'custom'].map(id => ({ id, apiModel: `gpt-${id}`, displayName: id, contextTokenLimit: 32000, maxOutputTokens: 8192 }))
  store.openProvider('provider')
  expect(store.modelRequestUrlPreview('provider', 'native')).toBe('https://relay.invalid/v1/messages')
  store.setModelProtocol('provider', 'custom', 'custom')
  store.setCustomRequestType('provider', 'custom', 'openai-responses')
  store.setCustomRequestPath('provider', 'custom', '//other.invalid/path')
  expect(store.validate('provider').modelErrors.custom.customRequestPath).toBeTruthy()
  store.setCustomRequestPath('provider', 'custom', '/gateway/respond?version=1')
  expect(store.modelRequestUrlPreview('provider', 'custom')).toBe('https://relay.invalid/gateway/respond?version=1')
  store.saveProvider('provider')
  const save = postMessage.mock.lastCall![0]
  expect(save).toMatchObject({ type: 'saveProviders', providers: [{ models: [{ type: 'anthropic' }, { type: 'openai-responses', customRequestPath: '/gateway/respond?version=1' }] }] })
  receive({ data: { type: 'saveProvidersResult', requestId: save.requestId, ok: true, state: { providers: save.providers } } })
  expect(store.editingProviderId).toBe('')
  store.openProvider('provider')
  store.setModelProtocol('provider', 'custom', 'gemini')
  expect(store.getModel('provider', 'custom').customRequestPath).toBeUndefined()
  store.cancelProviderEdit('provider')
  expect(store.modelRequestUrlPreview('provider', 'custom')).toContain('/gateway/respond')
})

it('saves an enabled-state change separately from the provider draft', () => {
  store.updateField('provider', 'name', '未保存名称')
  store.setProviderEnabled('provider', false)
  const toggle = postMessage.mock.lastCall![0]
  expect(toggle).toMatchObject({ type: 'setProviderEnabled', pid: 'provider', enabled: false })
  expect(toggle.providers).toBeUndefined()
  const saved = { ...store.state.providers[0], enabled: false }
  receive({ data: { type: 'saveProvidersResult', requestId: toggle.requestId, targetIds: ['provider'], ok: true, state: { providers: [saved] } } })
  expect(store.baseProvider('provider').enabled).toBe(false)
  expect(store.getDraft('provider').name).toBe('未保存名称')
  expect(store.savingProviders.provider).toBeUndefined()
})

it('retains single-model removal through the same draft confirmation', () => {
  store.state.providers[0].models = [{ id: 'one', apiModel: 'example', displayName: '示例模型' }]
  store.requestRemoveModel('provider', 'one')
  expect(store.confirmDialog).toMatchObject({ title: '删除模型', modelIds: ['one'] })
  store.confirmAction()
  expect(store.getDraft('provider').models).toEqual([])
  expect(store.state.providers[0].models).toHaveLength(1)
})
