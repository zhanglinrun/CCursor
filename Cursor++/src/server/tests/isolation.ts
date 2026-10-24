import { vi } from 'vitest'

// Each test file gets a synthetic home; tests must never read or write real BYOK data.
const testHome = vi.hoisted(() => {
  const { mkdtempSync } = process.getBuiltinModule('node:fs')
  const { tmpdir } = process.getBuiltinModule('node:os')
  const { join } = process.getBuiltinModule('node:path')
  return mkdtempSync(join(tmpdir(), 'ccursor-test-home-'))
})

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => testHome }
})
