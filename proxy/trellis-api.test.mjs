import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTrellisRequest, normalizeTrellisAddress } from './trellis-api.mjs'

test('normalizes schemeless Trellis addresses to HTTPS', () => {
  assert.equal(normalizeTrellisAddress('localhost:8128'), 'https://localhost:8128')
  assert.equal(normalizeTrellisAddress('trellis.internal:8128/'), 'https://trellis.internal:8128')
})

test('preserves explicit HTTP and HTTPS Trellis addresses', () => {
  assert.equal(normalizeTrellisAddress('http://localhost:8128/'), 'http://localhost:8128')
  assert.equal(normalizeTrellisAddress('https://trellis.example.com:8128'), 'https://trellis.example.com:8128')
})

test('uses the injected cluster CA for HTTPS requests', () => {
  const caCert = '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----'
  const { url, options } = buildTrellisRequest('trellis.internal:8128', '/v1/allocations', {
    token: 'token',
    namespace: 'production',
    caCert,
  })

  assert.equal(url.href, 'https://trellis.internal:8128/v1/allocations')
  assert.equal(options.ca, caCert)
  assert.equal(options.headers.authorization, 'Bearer token')
  assert.equal(options.headers['x-trellis-namespace'], 'production')
})

test('does not attach a CA override to plaintext HTTP requests', () => {
  const { options } = buildTrellisRequest('http://localhost:8128', '/v1/allocations', {
    token: 'token',
    namespace: 'production',
    caCert: 'ignored',
  })

  assert.equal(options.ca, undefined)
})
