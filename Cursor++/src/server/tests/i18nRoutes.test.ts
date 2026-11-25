import type { FastifyInstance, FastifyServerOptions } from 'fastify'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:net'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { getI18nStatus, updateI18nConfig } from '../config/i18nStore'
import { pushI18nUpdate, startServer, stopServer } from '../index'

const fixture = vi.hoisted(() => ({ server: undefined as FastifyInstance | undefined }))
vi.mock('fastify', async (importOriginal) => {
  const { default: fastify } = await importOriginal<typeof import('fastify')>()
  return {
    default(options: FastifyServerOptions) {
      fixture.server = fastify(options)
      return fixture.server
    },
  }
})

const host = '127.0.0.1'
let baseUrl: string
beforeAll(async () => {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => probe.once('error', reject).listen(0, host, resolve))
  const { port } = probe.address() as AddressInfo
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  await startServer({ host, port })
  baseUrl = `http://${host}:${port}`
})
afterAll(() => stopServer())

it('returns JSON and both supported forms of the ETag validator', async () => {
  const response = await fetch(`${baseUrl}/byok/i18n`)
  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload).toEqual({ enabled: false, locale: 'zh-CN', hash: getI18nStatus().hash })
  expect(response.headers.get('etag')).toBe(`"${payload.hash}"`)
  expect(response.headers.get('cache-control')).toBe('no-cache')
  for (const validator of [payload.hash, response.headers.get('etag')!]) {
    const cached = await fetch(`${baseUrl}/byok/i18n`, { headers: { 'If-None-Match': validator } })
    expect(cached.status).toBe(304)
    expect(await cached.text()).toBe('')
  }
})

it('rejects a non-loopback POST without changing settings', async () => {
  const before = getI18nStatus()
  const result = await fixture.server!.inject({
    method: 'POST',
    url: '/byok/i18n',
    remoteAddress: '192.0.2.10',
    payload: { enabled: !before.enabled },
  })
  expect(result.statusCode).toBe(403)
  expect(getI18nStatus()).toEqual(before)
})

it('rejects a POST with an Origin header from loopback without changing settings', async () => {
  const before = getI18nStatus()
  const result = await fixture.server!.inject({
    method: 'POST',
    url: '/byok/i18n',
    remoteAddress: '127.0.0.1',
    headers: { origin: 'https://example.com' },
    payload: { enabled: !before.enabled },
  })
  expect(result.statusCode).toBe(403)
  expect(getI18nStatus()).toEqual(before)
})

it('streams initial status and each toggle or reload to connected renderers', async () => {
  const streams = await Promise.all([1, 2].map(async () => {
    const response = await fetch(`${baseUrl}/byok/events`, { signal: AbortSignal.timeout(6000) })
    expect(response.status).toBe(200)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    return {
      reader,
      async next() {
        for (;;) {
          const end = buffer.indexOf('\n\n')
          if (end !== -1) {
            const event = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const prefix = 'event: i18n\ndata: '
            if (event.startsWith(prefix))
              return JSON.parse(event.slice(prefix.length))
            continue
          }
          const result = await reader.read()
          if (result.done)
            throw new Error('SSE closed before an i18n event arrived')
          buffer += decoder.decode(result.value, { stream: true })
        }
      },
    }
  }))
  const post = (body: object) => fetch(`${baseUrl}/byok/i18n`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const expectEvent = async (enabled: boolean, hash: string) => {
    const events = await Promise.all(streams.map(stream => stream.next()))
    expect(events).toEqual([{ enabled, hash }, { enabled, hash }])
  }
  try {
    const initialHash = getI18nStatus().hash
    await expectEvent(false, initialHash)
    const response = await post({ enabled: true })
    expect(response.status).toBe(200)
    const enabled = await response.json()
    expect(enabled).toEqual(getI18nStatus())
    await expectEvent(true, enabled.hash)
    expect(enabled.hash).not.toBe(initialHash)

    await updateI18nConfig((draft) => {
      draft.custom.Agent = '助理'
    })
    const reloaded = await post({ reload: true })
    expect(reloaded.status).toBe(200)
    const changed = await reloaded.json()
    expect(changed.hash).not.toBe(enabled.hash)
    await expectEvent(true, changed.hash)
    const dictionary = await fetch(`${baseUrl}/byok/i18n`, { headers: { 'If-None-Match': `"${enabled.hash}"` } })
    expect(dictionary.status).toBe(200)
    expect(await dictionary.json()).toMatchObject({ hash: changed.hash, exact: { Agent: '助理' } })

    pushI18nUpdate()
    await expectEvent(true, changed.hash)
    expect((await post({ enabled: false })).status).toBe(200)
    await expectEvent(false, initialHash)
  }
  finally {
    await Promise.all(streams.map(stream => stream.reader.cancel()))
  }
})
