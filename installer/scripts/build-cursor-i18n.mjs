import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [flag, dir, ...extra] = process.argv.slice(2)
if (flag !== '--source' || !dir || extra.length)
  throw new Error('Usage: node installer/scripts/build-cursor-i18n.mjs --source <dir>')

const source = {
  repo: 'svipm/cursor-i18n-zh',
  url: 'https://github.com/svipm/cursor-i18n-zh',
  license: 'MIT',
  commit: '7a59a59c5a2abfffdcc04cf285cff6ca51f3ec40',
  commitDate: '2026-11-21T02:43:45Z',
}
const read = name => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const metadata = read('META.json')
if (Object.entries(source).some(([key, value]) => metadata[key] !== value))
  throw new Error('Dictionary metadata does not match the pinned source')

const banned = new Set('tab git pr pro ultra bug api mcp ssh wsl cli url json html css http sql max id'.split(' '))
const exactWords = new Set(`Automations Customize Preferences Settings Notifications Extensions Repositories
Workspaces Upgrade Continue Confirm Refresh Discard Archive Archived Pinned Loading Generating
Completed Cancelled Preview Restore Yesterday Feedback Billing Account Privacy Security General
Features Appearance Keyboard Shortcuts Terminal Commands Indexing Context History Summary Details
Advanced Disable Disabled Enabled Install Installed Uninstall Updating Checking Selected Download
Uploading Connecting Connected Disconnected Searching Thinking Waiting Running Pending Skipped Applied
Reverted Rejected Accepted Today Older`.split(/\s+/))
function hasBalancedParentheses(key) {
  let depth = 0
  for (const char of key) {
    if (char === '(')
      depth++
    else if (char === ')') {
      depth--
      if (depth < 0)
        return false
    }
  }
  return depth === 0
}

const exact = new Map()
const shortUi = new Map()
for (const file of ['00-common', '10-chat', '20-settings', '30-editor', '40-panels', '50-tray']) {
  for (const [key, value] of Object.entries(read(`${file}.json`))) {
    const translation = typeof value === 'string' ? value : value?.zh
    const zh = typeof translation === 'string' ? translation.trim() : ''
    const en = key.replace(/\s+/g, ' ')
    if (!zh || key !== key.trim() || en === zh || en.startsWith('//') || !/[A-Za-z]/.test(en)
      || en.length > 400 || /^[a-z]+$/.test(en) || banned.has(en.toLowerCase()) || !hasBalancedParentheses(en))
      continue
    const target = exactWords.has(en) || /[\s,/:.!?;–—()[\]]/.test(en) ? exact : shortUi
    target.set(en, zh)
  }
}

for (const [key, value] of Object.entries({
  'Plan, Build, / for skills, @ for context': '规划、构建，输入 / 调用技能，@ 添加上下文',
  'Ask follow-ups in the worktree': '在工作树中继续追问',
  'Add a follow-up': '继续追问',
  'Ask, learn, brainstorm': '提问、学习、头脑风暴',
  'Work on explicitly added files (no tools)': '仅处理显式添加的文件（不调用工具）',
  'Refresh model list': '刷新模型列表',
  'Refresh Models': '刷新模型',
  'Background Agents': '后台智能体',
  'Agents Window': '智能体窗口',
  'Cursor Settings': 'Cursor 设置',
  'Just now': '刚刚',
  'Free Plan': '免费套餐',
  'Last 7 Days': '最近 7 天',
  'Last 30 Days': '最近 30 天',
  'Today': '今天',
  'Yesterday': '昨天',
  'Older': '更早',
  'Features': '功能',
  'Extensions': '扩展',
  'New Text File': '新建文本文件',
  'New Window': '新建窗口',
  'Open Recent': '打开最近的文件',
  'Save As...': '另存为…',
  'Save All': '全部保存',
  'Close Editor': '关闭编辑器',
  'Close Folder': '关闭文件夹',
  'Replace in Files': '在文件中替换',
  'Expand Selection': '展开选定内容',
  'Shrink Selection': '缩小选定内容',
  'Command Palette...': '命令面板…',
  'Open View...': '打开视图…',
  'Editor Layout': '编辑器布局',
  'Split Terminal': '拆分终端',
  'Run Task...': '运行任务…',
  'Run Build Task...': '运行生成任务…',
  'Release Notes': '发行说明',
  'Check for Updates...': '检查更新…',
})) {
  exact.set(key, value)
}
for (const [key, value] of Object.entries({
  Debug: '调试',
  Agent: '智能体',
  Models: '模型',
  Rules: '规则',
  Selection: '选择',
  Go: '转到',
  Exit: '退出',
  Redo: '重做',
  Explorer: '资源管理器',
  Welcome: '欢迎',
  About: '关于',
})) {
  shortUi.set(key, value)
}

const patterns = [
  [/^(\d+)\s+seconds?\s+ago$/i, '$1 秒前'],
  [/^(\d+)\s+minutes?\s+ago$/i, '$1 分钟前'],
  [/^(\d+)\s+hours?\s+ago$/i, '$1 小时前'],
  [/^(\d+)\s+days?\s+ago$/i, '$1 天前'],
  [/^Last\s+(\d+)\s+Days$/, '最近 $1 天'],
  [/^Thought for\s+(\d+)s$/, '已思考 $1 秒'],
  [/^Thought for\s+(\d+)\s+seconds?$/, '已思考 $1 秒'],
  [/^(\d+)\s+files?\s+changed$/, '已更改 $1 个文件'],
].map(([regex, replacement]) => ({ source: regex.source, flags: regex.flags, replacement }))

const sorted = map => Object.fromEntries([...map.keys()].sort().map(key => [key, map.get(key)]))
const asset = { version: 1, locale: 'zh-CN', source, exact: sorted(exact), shortUi: sorted(shortUi), patterns }
writeFileSync(new URL('../assets/cursor-i18n-zh.json', import.meta.url), `${JSON.stringify(asset, null, 2)}\n`)
console.log(`Built cursor-i18n-zh.json (${exact.size} exact, ${shortUi.size} shortUi, ${patterns.length} patterns)`)
