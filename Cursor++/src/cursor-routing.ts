import { createHash } from 'node:crypto'
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs'
import { join } from 'node:path'

function containsMarker(file: string, marker: string): boolean {
  try {
    const fd = openSync(file, 'r')
    try {
      const buffer = Buffer.alloc(128 * 1024)
      const size = readSync(fd, buffer)
      return buffer.subarray(0, size).includes(marker)
    }
    finally {
      closeSync(fd)
    }
  }
  catch {
    return false
  }
}

/**
 * 检查 extensionHostProcess.js 里的内置扩展哈希表是否已同步 cursor-always-local/dist/main.js 的 sha256。
 *
 * 找不到 extensionHostProcess.js 或该版本没有内置扩展哈希表条目时视为兼容（返回 true）；
 * 存在条目却不含当前 sha256 时返回 false，触发面板提醒用户重新注入。
 */
function hasSyncedAlwaysLocalHash(appRoot: string, agentMainPath: string): boolean {
  const extensionHostJs = join(appRoot, 'out', 'vs', 'workbench', 'api', 'node', 'extensionHostProcess.js')
  if (!existsSync(extensionHostJs))
    return true
  try {
    const hostSource = readFileSync(extensionHostJs, 'utf8')
    const hasEntry = /["'][^"']*cursor-always-local["']\s*:\s*\{\s*["']?dist["']?\s*:\s*\{/.test(hostSource)
    if (!hasEntry)
      return true
    const actualHash = createHash('sha256').update(readFileSync(agentMainPath, 'utf8')).digest('hex')
    return hostSource.includes(actualHash)
  }
  catch {
    return true
  }
}

export function hasCursorRoutingPatch(appRoot: string): boolean {
  const workbench = join(appRoot, 'out', 'vs', 'workbench')
  const desktop = join(workbench, 'workbench.desktop.main.js')
  const glass = join(workbench, 'workbench.glass.main.js')
  const agent = join(appRoot, 'extensions', 'cursor-always-local', 'dist', 'main.js')
  const hook = '/* CURSOR-BYOK-HOOK-START */'
  return containsMarker(desktop, hook)
    && (!existsSync(glass) || containsMarker(glass, hook))
    && containsMarker(agent, '__byokUrlRewrite')
    && hasSyncedAlwaysLocalHash(appRoot, agent)
}
