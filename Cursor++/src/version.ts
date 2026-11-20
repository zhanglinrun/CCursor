import { version as PACKAGE_VERSION } from '../package.json'

export const EXTENSION_VERSION = PACKAGE_VERSION

export function compareVersions(a: string, b: string): number {
  const pa = a.trim().replace(/^v/i, '').split('.').map(Number)
  const pb = b.trim().replace(/^v/i, '').split('.').map(Number)

  if (pa.length === 0 || pb.length === 0 || pa.some(part => !Number.isFinite(part)) || pb.some(part => !Number.isFinite(part)))
    return 0

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va !== vb)
      return va - vb
  }
  return 0
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}
