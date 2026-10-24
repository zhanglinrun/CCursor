import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Keep npm's root lock metadata aligned without changing dependency resolutions. */
export function writePackageVersion(dir, nextVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(nextVersion))
    throw new Error(`Invalid release version: ${nextVersion}`)
  const path = join(dir, 'package.json')
  const source = readFileSync(path, 'utf8')
  const manifest = JSON.parse(source)
  const pattern = /^(\s*"version"\s*:\s*")[^"]+(")/m
  if (typeof manifest.version !== 'string' || !pattern.test(source))
    throw new Error(`Missing package version: ${path}`)
  const lockPath = join(dir, 'package-lock.json')
  let lock
  if (existsSync(lockPath)) {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    if (!lock.packages?.[''])
      throw new Error(`Missing root package in ${lockPath}`)
    lock.version = nextVersion
    lock.packages[''].version = nextVersion
  }
  writeFileSync(path, source.replace(pattern, `$1${nextVersion}$2`))
  if (lock)
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
}
