import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { hasCursorRoutingPatch } from '../../cursor-routing'

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
    writeFileSync(agent, 'globalThis.__byokUrlRewrite = true')
    expect(hasCursorRoutingPatch(app)).toBe(true)
    writeFileSync(glass, 'updated Cursor renderer')
    expect(hasCursorRoutingPatch(app)).toBe(false)
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})

it('detects stale extensionHostProcess hash for cursor-always-local', () => {
  const app = mkdtempSync(join(tmpdir(), 'cursor-routing-hash-'))
  const renderer = '/* CURSOR-BYOK-HOOK-START */'
  const desktop = join(app, 'out/vs/workbench/workbench.desktop.main.js')
  const agent = join(app, 'extensions/cursor-always-local/dist/main.js')
  const extHost = join(app, 'out/vs/workbench/api/node/extensionHostProcess.js')
  try {
    mkdirSync(dirname(desktop), { recursive: true })
    mkdirSync(dirname(agent), { recursive: true })
    mkdirSync(dirname(extHost), { recursive: true })
    writeFileSync(desktop, renderer)
    const agentContent = 'globalThis.__byokUrlRewrite = true'
    writeFileSync(agent, agentContent)
    const actualHash = createHash('sha256').update(agentContent).digest('hex')

    writeFileSync(extHost, `var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${'0'.repeat(64)}"}}};`)
    expect(hasCursorRoutingPatch(app)).toBe(false)

    writeFileSync(extHost, `var s3={"anysphere.cursor-always-local":{dist:{"main.js":"${actualHash}"}}};`)
    expect(hasCursorRoutingPatch(app)).toBe(true)
  }
  finally {
    rmSync(app, { recursive: true, force: true })
  }
})
