export const MAX_PAYLOAD = 32 * 1024

export function encodeFrame(type, payload = Buffer.alloc(0)) {
  payload = Buffer.from(payload)
  if (payload.length > MAX_PAYLOAD) throw new Error('Exec frame exceeds 32 KiB')
  const frame = Buffer.allocUnsafe(1 + payload.length)
  frame[0] = type
  payload.copy(frame, 1)
  return frame
}

export function decodeFrame(frame) {
  if (!Buffer.isBuffer(frame)) throw new Error('Exec requires binary messages')
  if (frame.length < 1 || frame.length > MAX_PAYLOAD + 1) throw new Error('Invalid exec frame length')
  return { type: frame[0], payload: frame.subarray(1) }
}

export function validateInput(frame) {
  const { type, payload } = decodeFrame(frame)
  if (type === 1) return
  if (type === 2 && payload.length === 0) return
  if (type === 3) {
    const { cols, rows } = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))
    if (Number.isInteger(cols) && cols >= 1 && cols <= 1000
      && Number.isInteger(rows) && rows >= 1 && rows <= 1000) return
  }
  throw new Error('Invalid terminal input frame')
}
