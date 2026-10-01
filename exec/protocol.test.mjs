import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeFrame, decodeFrame, validateInput, MAX_PAYLOAD } from './protocol.mjs'

test('one-byte event header preserves raw payload and empty control payload', () => {
  const wire = Buffer.from([4, 0, 0xff, 0xe2, 0x82])
  assert.deepEqual(decodeFrame(wire), { type: 4, payload: Buffer.from([0, 0xff, 0xe2, 0x82]) })
  assert.deepEqual(encodeFrame(4, Buffer.from([0, 0xff, 0xe2, 0x82])), wire)
  assert.deepEqual(encodeFrame(2), Buffer.from([2]))
})

test('exact payload boundary accepted; oversized, empty and text messages rejected', () => {
  const frame = encodeFrame(4, Buffer.alloc(MAX_PAYLOAD, 0x91))
  assert.equal(frame.length, 32769)
  assert.deepEqual(decodeFrame(frame).payload, Buffer.alloc(32768, 0x91))
  assert.throws(() => decodeFrame(Buffer.alloc(32770)), /length/)
  assert.throws(() => decodeFrame(Buffer.alloc(0)), /length/)
  assert.throws(() => decodeFrame('text'), /binary/)
  assert.throws(() => encodeFrame(1, Buffer.alloc(MAX_PAYLOAD + 1)), /32 KiB/)
})

test('stdin/EOF/resize directions and asymmetric dimension boundaries', () => {
  validateInput(Buffer.from([1, 0, 0xff, 13]))
  validateInput(Buffer.from([2]))
  for (const size of [{ cols: 1, rows: 1000 }, { cols: 997, rows: 23 }]) validateInput(encodeFrame(3, JSON.stringify(size)))
  for (const size of [{ cols: 0, rows: 23 }, { cols: 1001, rows: 23 }, { cols: 97, rows: 0 }, { cols: 97, rows: 1001 }, { cols: 97.5, rows: 23 }]) {
    assert.throws(() => validateInput(encodeFrame(3, JSON.stringify(size))))
  }
  for (const wire of [encodeFrame(2, 'x'), encodeFrame(4, 'x'), encodeFrame(8), encodeFrame(3, '{')]) assert.throws(() => validateInput(wire))
})
