type ConvertFn = (html: string, options: Record<string, unknown>) => string

type LoadResult
  = | { ok: true, convert: ConvertFn }
    | { ok: false, error: Error }

let cached: LoadResult | null = null
let notifier: ((error: Error) => void) | null = null
let notified = false

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function notify(error: Error): void {
  if (notified)
    return
  notified = true
  notifier?.(error)
}

export function isLikelyWindowsMsvcMissing(error: unknown): boolean {
  if (process.platform !== 'win32')
    return false
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  return /supermarkdown\.win32-x64-msvc\.node/i.test(message)
    && (/The specified module could not be found/i.test(message) || /找不到指定的模块/.test(message))
}

export function supermarkdownUnavailableMessage(_error?: Error): string {
  if (process.platform === 'win32') {
    return '内置抓取不可用，supermarkdown 原生模块加载失败。请安装 Microsoft Visual C++ 2015–2022 x64 运行库，然后重启 Cursor。'
  }
  return '内置抓取不可用，supermarkdown 原生模块加载失败。请重启 Cursor，或重新安装 Cursor++。'
}

export function setSupermarkdownNativeErrorNotifier(fn: (error: Error) => void): void {
  notifier = fn
  if (cached && !cached.ok)
    notify(cached.error)
}

export function loadSupermarkdown(): LoadResult {
  if (cached)
    return cached

  try {
    // Lazy-load the native module so extension activation does not fail when
    // Windows lacks the MSVC runtime required by supermarkdown.win32-x64-msvc.node.

    const mod = require('@vakra-dev/supermarkdown') as { convert?: ConvertFn }
    if (typeof mod.convert !== 'function')
      throw new TypeError('@vakra-dev/supermarkdown did not export convert()')
    cached = { ok: true, convert: mod.convert }
  }
  catch (error) {
    cached = { ok: false, error: toError(error) }
    notify(cached.error)
  }

  return cached
}

export function preflightSupermarkdown(): void {
  loadSupermarkdown()
}
