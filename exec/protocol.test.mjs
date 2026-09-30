import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { encodeFrame, decodeFrame, readFrames, validateInput, MAX_PAYLOAD } from './protocol.mjs'

test('decoder handles every split, coalesced frames, raw bytes and zero-length frames', async () => {
  // Independently specified wire bytes, including half a UTF-8 character and NUL.
  const wire = Buffer.from([4, 0, 0, 0, 4, 0, 0xff, 0xe2, 0x82, 5, 0, 0, 0, 1, 0xac, 2, 0, 0, 0, 0])
  for (let split = 1; split < wire.length; split++) {
    const frames = await Array.fromAsync(readFrames(Readable.from([wire.subarray(0, split), wire.subarray(split)])))
    assert.deepEqual(frames.map(decodeFrame), [
      { type: 4, payload: Buffer.from([0, 0xff, 0xe2, 0x82]) },
      { type: 5, payload: Buffer.from([0xac]) }, { type: 2, payload: Buffer.alloc(0) },
    ])
  }
})

test('exact payload boundary accepted; oversized headers rejected before reading payload', async () => {
  const frame = encodeFrame(4, Buffer.alloc(MAX_PAYLOAD, 0x91))
  const result = await Array.fromAsync(readFrames(Readable.from([...frame].map((byte) => Buffer.from([byte])))))
  assert.deepEqual(result, [frame])
  await assert.rejects(Array.fromAsync(readFrames(Readable.from([Buffer.from([4, 0, 0, 0x80, 1])]))), /32 KiB/)
  assert.throws(() => encodeFrame(1, Buffer.alloc(MAX_PAYLOAD + 1)), /32 KiB/)
})

test('truncated headers/payloads and inconsistent WebSocket frames rejected', async () => {
  for (const wire of [[4], [4, 0, 0, 0, 2, 9]]) {
    await assert.rejects(Array.fromAsync(readFrames(Readable.from([Buffer.from(wire)]))), /Truncated/)
    assert.throws(() => decodeFrame(Buffer.from(wire)))
  }
})

test('stdin/EOF/resize directions and asymmetric dimension boundaries', () => {
  validateInput(Buffer.from([1, 0, 0, 0, 3, 0, 0xff, 13]))
  validateInput(Buffer.from([2, 0, 0, 0, 0]))
  for (const size of [{ cols: 1, rows: 1000 }, { cols: 997, rows: 23 }]) validateInput(encodeFrame(3, JSON.stringify(size)))
  for (const size of [{ cols: 0, rows: 23 }, { cols: 1001, rows: 23 }, { cols: 97, rows: 0 }, { cols: 97, rows: 1001 }, { cols: 97.5, rows: 23 }]) {
    assert.throws(() => validateInput(encodeFrame(3, JSON.stringify(size))))
  }
  for (const wire of [encodeFrame(2, 'x'), encodeFrame(4, 'x'), encodeFrame(8), encodeFrame(3, '{')]) assert.throws(() => validateInput(wire))
})
