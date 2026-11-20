import type { LLMProvider, LLMStreamEvent, LLMStreamRequest } from './types'

async function readProviderEvent(iterator: AsyncIterator<LLMStreamEvent>, signal: AbortSignal): Promise<IteratorResult<LLMStreamEvent>> {
  signal.throwIfAborted()
  let onAbort!: () => void
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  // An SDK or a relay may leave next() pending even after its signal is aborted.
  const pending = Promise.resolve().then(() => {
    signal.throwIfAborted()
    return iterator.next()
  })
  try {
    const next = await Promise.race([pending, aborted])
    signal.throwIfAborted()
    return next
  }
  finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export function openProviderStream(provider: LLMProvider, request: LLMStreamRequest, parentSignal?: AbortSignal) {
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, ...[parentSignal, request.signal].filter(signal => signal !== undefined)])
  let iterator: AsyncIterator<LLMStreamEvent> | undefined
  let closed = false

  function close(): void {
    if (closed)
      return
    closed = true
    signal.removeEventListener('abort', close)
    if (!iterator)
      return
    controller.abort()
    // Async generators queue return() behind pending next(). Request cleanup without waiting for it.
    void Promise.resolve().then(() => iterator?.return?.()).catch(() => {})
  }

  async function* events(): AsyncGenerator<LLMStreamEvent> {
    try {
      signal.throwIfAborted()
      if (closed)
        return
      iterator = provider.stream({ ...request, signal })[Symbol.asyncIterator]()
      signal.addEventListener('abort', close, { once: true })
      for (;;) {
        const next = await readProviderEvent(iterator, signal)
        if (next.done) {
          iterator = undefined
          return
        }
        yield next.value
        if (next.value.type === 'done')
          return
      }
    }
    finally {
      close()
    }
  }

  return { events: events(), close }
}
