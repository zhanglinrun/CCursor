import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { hasCursorRoutingPatch, inspectCursorRoutingPatch } from '../../cursor-routing'

it('detects the missing routing files when Cursor replaces its program files', () => {
  const app = mkdtempSync(join(tmpdir(), 'cursor-routing-'))
  const renderer = '/* CURSOR-BYOK-HOOK-START */'
  const desktop = join(app, 'out/vs/workbench/workbench.desktop.main.js')
  const glass = join(app, 'out/vs/workbench/workbench.glass.main.js')
  const agent = join(app, 'extensions/cursor-always-local/dist/main.js')
  try {
    mkdirSync(dirname(desktop), { recursive: true })
    mkdirSync(dirname(agent), { recursive: true })
    writeFileSync(desktop, renderer)
    writeFileSync(glass, renderer)
    expect(hasCursorRoutingPatch(app)).toBe(false)
    expect(inspectCursorRoutingPatch(app)).toEqual({ present: false, reason: 'missing_always_local' })
    writeFileSync(agent, 'globalThis.__byokUrlRewrite = true')
    expect(hasCursorRoutingPatch(app)).toBe(true)
    writeFileSync(glass, 'updated Cursor renderer')
    expect(hasCursorRoutingPatch(app)).toBe(false)
    expect(inspectCursorRoutingPatch(app)).toEqual({ present: false, reason: 'missing_renderer' })
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})

function hashFixture() {
  const app = mkdtempSync(join(tmpdir(), 'cursor-routing-hash-'))
  const renderer = '/* CURSOR-BYOK-HOOK-START */'
  const desktop = join(app, 'out/vs/workbench/workbench.desktop.main.js')
  const agent = join(app, 'extensions/cursor-always-local/dist/main.js')
  const extHost = join(app, 'out/vs/workbench/api/node/extensionHostProcess.js')
  mkdirSync(dirname(desktop), { recursive: true })
  mkdirSync(dirname(agent), { recursive: true })
  mkdirSync(dirname(extHost), { recursive: true })
  writeFileSync(desktop, renderer)
  const agentContent = 'globalThis.__byokUrlRewrite = true'
  writeFileSync(agent, agentContent)
  const actualHash = createHash('sha256').update(agentContent).digest('hex')
  return { app, extHost, actualHash }
}

it('recognizes the routing hash when the next Cursor extension follows it in the verification map', () => {
  const { app, extHost, actualHash } = hashFixture()
  try {
    writeFileSync(extHost, `var s3={"anysphere.cursor-always-local":{dist:{"254.js":"other","main.js":"${actualHash.toUpperCase()}"}},"anysphere.cursor-browser-automation":{dist:{"extension.js":"other"}}};`)
    expect(hasCursorRoutingPatch(app)).toBe(true)
    expect(inspectCursorRoutingPatch(app)).toEqual({ present: true })
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})

it('checks the real hash map after an unrelated cursor-always-local object', () => {
  const { app, extHost, actualHash } = hashFixture()
  try {
    const source = `const settings={"anysphere.cursor-always-local":{enabled:true}};var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${actualHash}"}},"anysphere.cursor-browser-automation":{dist:{"extension.js":"other"}}};`
    writeFileSync(extHost, source)
    expect(hasCursorRoutingPatch(app)).toBe(true)
    writeFileSync(extHost, source.replace(actualHash, '0'.repeat(64)))
    expect(hasCursorRoutingPatch(app)).toBe(false)
    expect(inspectCursorRoutingPatch(app)).toEqual({ present: false, reason: 'hash_mismatch' })
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})

it('requires the cursor-always-local dist/main.js digest even when nested or sibling digests match', () => {
  const { app, extHost, actualHash } = hashFixture()
  try {
    const nested = `sub:{"main.js":"${actualHash}",metadata:{note:"}"}}`
    const sibling = `"anysphere.cursor-other":{dist:{"main.js":"${actualHash}"}}`
    writeFileSync(extHost, `var s3={"anysphere.cursor-always-local":{dist:{${nested},"main.js":"${'0'.repeat(64)}"}},${sibling}};`)
    expect(hasCursorRoutingPatch(app)).toBe(false)

    writeFileSync(extHost, `var s3={"anysphere.cursor-always-local":{dist:{${nested}}},${sibling}};`)
    expect(hasCursorRoutingPatch(app)).toBe(false)

    writeFileSync(extHost, `var s3={'anysphere.cursor-always-local':{'dist':{${nested},'main.js':'${actualHash}'}}};`)
    expect(hasCursorRoutingPatch(app)).toBe(true)
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})

it('fails closed for an unreadable host or a hash verifier without a matching map entry', () => {
  const { app, extHost, actualHash } = hashFixture()
  try {
    writeFileSync(extHost, `var s3={"anysphere.cursor-other":{dist:{"main.js":"${actualHash}"}}};`)
    expect(hasCursorRoutingPatch(app)).toBe(true)
    writeFileSync(extHost, 'const report = "Hash mismatch for files:";')
    expect(hasCursorRoutingPatch(app)).toBe(false)
    rmSync(extHost)
    mkdirSync(extHost)
    expect(hasCursorRoutingPatch(app)).toBe(false)
    expect(inspectCursorRoutingPatch(app)).toEqual({ present: false, reason: 'unreadable' })
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})
