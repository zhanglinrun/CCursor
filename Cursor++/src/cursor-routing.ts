import type { Expression } from 'acorn'
import { createHash } from 'node:crypto'
import { closeSync, openSync, readFileSync, readSync } from 'node:fs'
import { join } from 'node:path'
import { parseExpressionAt } from 'acorn'

export type RoutingPatchReason = 'missing_renderer' | 'missing_always_local' | 'hash_mismatch' | 'unreadable'

type RoutingPatchInspection = { present: true } | { present: false, reason: RoutingPatchReason }

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function containsMarker(file: string, marker: string, optional = false, bytes = 128 * 1024): boolean {
  try {
    const fd = openSync(file, 'r')
    try {
      const buffer = Buffer.alloc(bytes)
      const size = readSync(fd, buffer)
      return buffer.subarray(0, size).includes(marker)
    }
    finally {
      closeSync(fd)
    }
  }
  catch (error) {
    if (isMissing(error))
      return optional
    throw error
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
    if (isMissing(error))
      return true
    throw error
  }

  const matches = hostSource.matchAll(/(['"])(?:[^'"\r\n]+\.)?cursor-always-local\1\s*:\s*\{/g)
  let foundEntry = false
  let actualHash: string | undefined
  for (const match of matches) {
    foundEntry = true
    let node: Expression
    try {
      node = parseExpressionAt(hostSource, match.index + match[0].length - 1, { ecmaVersion: 'latest' })
    }
    catch {
      continue
    }
    // Acorn can consume the next key after the comma as part of a sequence.
    const entry = node.type === 'SequenceExpression' ? node.expressions[0] : node
    const mainHash = objectProperty(objectProperty(entry, 'dist'), 'main.js')
    if (mainHash?.type !== 'Literal' || typeof mainHash.value !== 'string')
      continue
    actualHash ??= createHash('sha256').update(readFileSync(agentMainPath)).digest('hex')
    if (mainHash.value.toLowerCase() === actualHash)
      return true
  }
  return !foundEntry && !hostSource.includes('checking expected hashes for') && !hostSource.includes('Hash mismatch for files:')
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

export function inspectCursorRoutingPatch(appRoot: string): RoutingPatchInspection {
  const workbench = join(appRoot, 'out', 'vs', 'workbench')
  const desktop = join(workbench, 'workbench.desktop.main.js')
  const glass = join(workbench, 'workbench.glass.main.js')
  const agent = join(appRoot, 'extensions', 'cursor-always-local', 'dist', 'main.js')
  const hook = '/* CURSOR-BYOK-HOOK-START */'
  try {
    if (!containsMarker(desktop, hook) || !containsMarker(glass, hook, true))
      return { present: false, reason: 'missing_renderer' }
    if (!containsMarker(agent, '__byokUrlRewrite'))
      return { present: false, reason: 'missing_always_local' }
    if (!hasSyncedAlwaysLocalHash(appRoot, agent))
      return { present: false, reason: 'hash_mismatch' }
    return { present: true }
  }
  catch {
    return { present: false, reason: 'unreadable' }
  }
}

export function hasCursorRoutingPatch(appRoot: string): boolean {
  return inspectCursorRoutingPatch(appRoot).present
}

export function hasCursorI18nHook(appRoot: string): boolean {
  const workbench = join(appRoot, 'out', 'vs', 'workbench')
  const revision = '__byokHookRev5'
  try {
    return containsMarker(join(workbench, 'workbench.desktop.main.js'), revision, false, 256 * 1024)
      && containsMarker(join(workbench, 'workbench.glass.main.js'), revision, true, 256 * 1024)
  }
  catch {
    return false
  }
}
