import { closeSync, existsSync, openSync, readSync } from 'node:fs'
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

export function hasCursorRoutingPatch(appRoot: string): boolean {
  const workbench = join(appRoot, 'out', 'vs', 'workbench')
  const desktop = join(workbench, 'workbench.desktop.main.js')
  const glass = join(workbench, 'workbench.glass.main.js')
  const agent = join(appRoot, 'extensions', 'cursor-always-local', 'dist', 'main.js')
  const hook = '/* CURSOR-BYOK-HOOK-START */'
  return containsMarker(desktop, hook)
    && (!existsSync(glass) || containsMarker(glass, hook))
    && containsMarker(agent, '__byokUrlRewrite')
}
