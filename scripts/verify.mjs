import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findCursorPathsDetailed } from '../installer/src/detect.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const extensionDir = join(root, 'Cursor++')
const installerDir = join(root, 'installer')
const tempDir = join(root, 'Temp', 'tests')
mkdirSync(tempDir, { recursive: true })
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const extension = readJson(join(extensionDir, 'package.json'))
const installer = readJson(join(installerDir, 'package.json'))
const lock = readJson(join(installerDir, 'package-lock.json'))
assert.equal(installer.version, extension.version, 'extension and installer versions must match')
assert.equal(lock.version, installer.version, 'installer lockfile version must match')
assert.equal(lock.packages[''].version, installer.version, 'lockfile root package version must match')
assert.equal(lock.name, installer.name, 'installer lockfile name must match')
const env = {
  ...process.env,
  CI: 'true',
  TEMP: tempDir,
  TMP: tempDir,
  TMPDIR: tempDir,
  npm_config_cache: join(root, 'Temp', 'cache', 'npm'),
  XDG_CACHE_HOME: join(root, 'Temp', 'cache'),
}
const cursorRoot = env.CURSOR_APP_ROOT || findCursorPathsDetailed().paths?.appRoot
if (cursorRoot)
  env.CURSOR_APP_ROOT = cursorRoot

function run(label, cwd, args) {
  console.log(`\n[verify] ${label}`)
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' })
  if (result.error)
    throw result.error
  if (result.status !== 0)
    throw new Error(`${label} failed (${result.signal || result.status})`)
}

for (const dependency of ['typescript', 'eslint', 'vitest']) {
  if (!existsSync(join(extensionDir, 'node_modules', dependency)))
    throw new Error(`Missing ${dependency}; run pnpm install --frozen-lockfile in Cursor++ first`)
}
run('TypeScript', extensionDir, ['node_modules/typescript/bin/tsc', '--noEmit'])
run('ESLint', extensionDir, ['node_modules/eslint/bin/eslint.js', 'src'])
run('Extension tests', extensionDir, ['node_modules/vitest/vitest.mjs', 'run'])
const installerTests = readdirSync(join(installerDir, 'test')).filter(name => name.endsWith('.test.mjs')).sort()
assert.ok(installerTests.length > 0, 'installer tests must not be empty')
run('Installer tests', installerDir, ['--test', ...installerTests.map(name => join('test', name))])
console.log(`\n[verify] All checks passed for ${extension.version}. No installation or publication performed.`)
