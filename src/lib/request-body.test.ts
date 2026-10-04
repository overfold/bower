import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { BODY_LIMITS, readRequestBody, RequestBodyError } from './request-body'

function streamed(chunks: Uint8Array[], headers?: HeadersInit) {
  return new Request('https://bower.test/', { method: 'POST', headers, body: new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() } }), duplex: 'half' } as RequestInit)
}

test('each endpoint limit rejects declared and chunked overflow and permits exact boundary', async () => {
  for (const limit of Object.values(BODY_LIMITS)) {
    await assert.rejects(readRequestBody(streamed([], { 'content-length': String(limit + 1) }), limit), (e: unknown) => e instanceof RequestBodyError && e.status === 413)
    await assert.rejects(readRequestBody(streamed([Buffer.alloc(limit - 2), Buffer.alloc(3)]), limit), (e: unknown) => e instanceof RequestBodyError && e.status === 413)
    assert.equal((await readRequestBody(streamed([Buffer.alloc(limit - 2), Buffer.alloc(2)]), limit)).length, limit)
  }
})

test('byte reader preserves asymmetric signature bytes across UTF-8/chunk boundaries', async () => {
  const raw = Buffer.from('{ "image": "team/app:v12.3", "note": "é λ" }\r\n')
  const split = raw.indexOf('é') + 1
  const result = await readRequestBody(streamed([raw.subarray(0, split), raw.subarray(split)]), BODY_LIMITS.webhook)
  assert.deepEqual(result, raw)
  // Independently computed with openssl dgst -sha256 -hmac different-secret.
  assert.equal(createHmac('sha256', 'different-secret').update(result).digest('hex'), '861d62726161afb40c08814b8b7fe7eeb0df3689fd07be75464ac291243bed01')
})

test('deadlines cancel slow streams; broken streams and malformed declared lengths fail cleanly', async () => {
  let cancelled = false
  const slow = new Request('https://bower.test/', { method: 'POST', body: new ReadableStream({ cancel() { cancelled = true } }), duplex: 'half' } as RequestInit)
  await assert.rejects(readRequestBody(slow, 8, 20), (e: unknown) => e instanceof RequestBodyError && e.status === 408)
  assert.equal(cancelled, true)
  const broken = new Request('https://bower.test/', { method: 'POST', body: new ReadableStream({ start(controller) { controller.error(new Error('broken')) } }), duplex: 'half' } as RequestInit)
  await assert.rejects(readRequestBody(broken, 8), (e: unknown) => e instanceof RequestBodyError && e.status === 400)
  await assert.rejects(readRequestBody(streamed([], { 'content-length': '1e3' }), 8), (e: unknown) => e instanceof RequestBodyError && e.status === 413)
})
