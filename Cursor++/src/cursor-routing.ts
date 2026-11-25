import type { Expression } from 'acorn'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs'
import { join } from 'node:path'
import { parseExpressionAt } from 'acorn'

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
 * 旧版本没有哈希校验时仍兼容。启用校验时，条目必须可读且与磁盘文件一致。
 */
function hasSyncedAlwaysLocalHash(appRoot: string, agentMainPath: string): boolean {
  const extensionHostJs = join(appRoot, 'out', 'vs', 'workbench', 'api', 'node', 'extensionHostProcess.js')
  let hostSource: string
  try {
    hostSource = readFileSync(extensionHostJs, 'utf8')
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
  }
  try {
    const entryMatch = /(['"])(?:[^'"\r\n]+\.)?cursor-always-local\1\s*:\s*\{/.exec(hostSource)
    if (!entryMatch) {
      const enforcesHash = hostSource.includes('checking expected hashes for') || hostSource.includes('Hash mismatch for files:')
      return !enforcesHash
    }
    const entry = parseExpressionAt(hostSource, entryMatch.index + entryMatch[0].length - 1, { ecmaVersion: 'latest' })
    const mainHash = objectProperty(objectProperty(entry, 'dist'), 'main.js')
    if (mainHash?.type !== 'Literal' || typeof mainHash.value !== 'string')
      return false
    const actualHash = createHash('sha256').update(readFileSync(agentMainPath)).digest('hex')
    return mainHash.value.toLowerCase() === actualHash
  }
  catch {
    return false
  }
}

function objectProperty(node: Expression | undefined, name: string): Expression | undefined {
  if (node?.type !== 'ObjectExpression')
    return undefined
  for (let index = node.properties.length - 1; index >= 0; index--) {
    const property = node.properties[index]
    if (property.type !== 'Property' || property.computed)
      continue
    const key = property.key
    if ((key.type === 'Identifier' && key.name === name) || (key.type === 'Literal' && key.value === name))
      return property.value
  }
  return undefined
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
