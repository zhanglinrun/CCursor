import { expect, it } from 'vitest'
import { ErrorDetailsSchema } from '../gen/aiserver_v1_shared_pb'
import { makeProviderError } from '../handlers/errors'

it('summarizes a gateway challenge while keeping the retry button', () => {
  const error = makeProviderError(new Error('HTTP 403: <!doctype html><html><title>Vercel Security Checkpoint</title></html>'))
  const banner = error.findDetails(ErrorDetailsSchema)[0]?.details
  expect(banner).toMatchObject({ title: 'Upstream gateway security check', isRetryable: true })
  expect(banner?.detail).toContain('HTTP 403')
  expect(banner?.detail).not.toContain('<html>')
})

it('still treats an ordinary forbidden response as an authentication failure', () => {
  const error = makeProviderError(new Error('HTTP 403: access denied'))
  expect(error.findDetails(ErrorDetailsSchema)[0]?.details).toMatchObject({ detail: 'HTTP 403: access denied', isRetryable: false })
})
