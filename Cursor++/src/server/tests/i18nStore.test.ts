import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { ensureI18nFile, getI18nPayload, getI18nStatus, loadI18nConfig, onI18nChange, setI18nEnabled, startI18nWatcher, stopI18nWatcher, updateI18nConfig } from '../config/i18nStore'
import { getI18nFilePath } from '../config/paths'

afterEach(() => {
  stopI18nWatcher()
  rmSync(getI18nFilePath(), { force: true })
})

it('loads a curated and partitioned dictionary with the Cursor 3.32 translations', async () => {
  await setI18nEnabled(true)
  const payload = getI18nPayload()
  if (!payload.enabled)
    throw new Error('Expected an enabled dictionary')
  const { exact, shortUi, patterns } = payload
  expect(Object.keys(exact).length).toBeGreaterThan(3000)
  for (const [key, value] of Object.entries({ ...exact, ...shortUi })) {
    expect(value.trim()).not.toBe('')
    expect(value.trim()).not.toBe(key.trim())
    expect(key).not.toMatch(/^(?:\/\/|[a-z]+$)/)
  }
  for (const banned of ['on', 'at', 'root', 'Tab', 'Git', 'MCP', 'Max']) {
    expect(exact).not.toHaveProperty(banned)
    expect(shortUi).not.toHaveProperty(banned)
  }
  expect(exact).toMatchObject({
    'Plan, Build, / for skills, @ for context': '规划、构建，输入 / 调用技能，@ 添加上下文',
    'Ask follow-ups in the worktree': '在工作树中继续追问',
    'Refresh model list': '刷新模型列表',
    'In Progress': '进行中',
    'Menu Bar Icon': '菜单栏图标',
    'Agent Conversations': '智能体会话',
    'Today': '今天',
    'Older': '更早',
    'Extensions': '扩展',
    'New Text File': '新建文本文件',
    'Save As...': '另存为…',
    'Command Palette...': '命令面板…',
  })
  expect(shortUi).toMatchObject({ Agent: '智能体', Debug: '调试', Models: '模型', Rules: '规则' })
  expect(shortUi).toMatchObject({ Selection: '选择', Go: '转到', Exit: '退出', Redo: '重做', Explorer: '资源管理器', Welcome: '欢迎', About: '关于' })
  expect(exact).not.toHaveProperty('days)')
  expect(shortUi).not.toHaveProperty('days)')
  expect(Object.keys(shortUi).filter(key => Object.hasOwn(exact, key))).toEqual([])
  expect(patterns).toHaveLength(8)
  expect(patterns.every(({ source }) => source.startsWith('^') && source.endsWith('$'))).toBe(true)
})

it('merges and disables keys, hashes effective content deterministically, and persists concurrent updates', async () => {
  const path = getI18nFilePath()
  expect(await ensureI18nFile()).toEqual({ $schemaVersion: 1, enabled: false, locale: 'zh-CN', custom: {}, disabledKeys: [] })
  const disabled = getI18nPayload()
  expect(disabled).toEqual({ enabled: false, locale: 'zh-CN', hash: expect.stringMatching(/^[a-f0-9]{16}$/) })
  await Promise.all([
    updateI18nConfig((draft) => {
      draft.custom = { 'Unique UI': '自定义', ' Agent ': '代理', 'Refresh model list': '刷新' }
    }),
    updateI18nConfig((draft) => {
      draft.disabledKeys = ['Rules', 'Today', 'Refresh model list']
    }),
  ])
  expect(getI18nPayload()).toEqual(disabled)
  const persisted = await setI18nEnabled(true)
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(persisted)
  expect(loadI18nConfig()).toEqual(persisted)
  expect(readdirSync(dirname(path)).filter(name => name.startsWith('i18n.json.tmp-'))).toEqual([])

  const payload = getI18nPayload()
  if (!payload.enabled)
    throw new Error('Expected an enabled dictionary')
  expect(payload.exact).toMatchObject({ 'Agent': '代理', 'Unique UI': '自定义' })
  expect(payload.exact).not.toHaveProperty('Today')
  expect(payload.exact).not.toHaveProperty('Refresh model list')
  expect(payload.shortUi).not.toHaveProperty('Agent')
  expect(payload.shortUi).not.toHaveProperty('Rules')
  const status = getI18nStatus()
  expect(status).toMatchObject({ hash: payload.hash, configPath: path, customCount: 3, totalCount: status.bundledCount - 2 })
  expect(status.custom).toEqual(persisted.custom)
  expect(status.disabledKeys).toEqual(persisted.disabledKeys)
  expect(payload.disabledKeys).toEqual(persisted.disabledKeys)
  status.custom.Agent = '临时值'
  status.disabledKeys.push('Settings')
  expect(getI18nStatus()).toMatchObject({ custom: persisted.custom, disabledKeys: persisted.disabledKeys })

  writeFileSync(path, JSON.stringify({
    ...persisted,
    custom: Object.fromEntries(Object.entries(persisted.custom).reverse()),
    disabledKeys: [...persisted.disabledKeys].reverse(),
  }))
  expect(getI18nPayload()).toEqual(payload)
  writeFileSync(path, JSON.stringify({ ...persisted, custom: { ...persisted.custom, Agent: '助理' } }))
  expect(getI18nPayload().hash).not.toBe(payload.hash)
  await setI18nEnabled(false)
  expect(getI18nPayload()).toEqual(disabled)
})

it('preserves an invalid file while the user edits it', async () => {
  const path = getI18nFilePath()
  await ensureI18nFile()
  writeFileSync(path, '{')
  await ensureI18nFile()
  await expect(setI18nEnabled(true)).rejects.toThrow('unreadable localization config')
  expect(readFileSync(path, 'utf8')).toBe('{')
})

it('emits updates after external atomic writes and stops watching cleanly', async () => {
  await ensureI18nFile()
  const onChange = vi.fn()
  const dispose = onI18nChange(onChange)
  startI18nWatcher()
  try {
    await setI18nEnabled(true)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 4500 })
    expect(getI18nStatus().enabled).toBe(true)
  }
  finally {
    dispose()
  }
})
