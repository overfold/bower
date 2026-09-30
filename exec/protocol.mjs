export const MAX_PAYLOAD = 32 * 1024

export function encodeFrame(type, payload = Buffer.alloc(0)) {
  payload = Buffer.from(payload)
  if (payload.length > MAX_PAYLOAD) throw new Error('Exec frame exceeds 32 KiB')
  const frame = Buffer.allocUnsafe(5 + payload.length)
  frame[0] = type
  frame.writeUInt32BE(payload.length, 1)
  payload.copy(frame, 5)
  return frame
}

export function decodeFrame(frame) {
  if (frame.length < 5) throw new Error('Truncated exec header')
  const length = frame.readUInt32BE(1)
  if (length > MAX_PAYLOAD || frame.length !== length + 5) throw new Error('Invalid exec frame length')
  return { type: frame[0], payload: frame.subarray(5) }
}

// One fixed-size frame plus the socket's bounded read buffer. Yielding stops
// reads while the browser renders output, so backpressure reaches Trellis.
export async function* readFrames(source) {
  const buffer = Buffer.allocUnsafe(5 + MAX_PAYLOAD)
  let used = 0
  let size = 5
  for await (const chunk of source) {
    let offset = 0
    while (offset < chunk.length) {
      const count = Math.min(size - used, chunk.length - offset)
      chunk.copy(buffer, used, offset, offset + count)
      used += count
      offset += count
      if (used !== size) continue
      if (size === 5) {
        const length = buffer.readUInt32BE(1)
        if (length > MAX_PAYLOAD) throw new Error('Exec frame exceeds 32 KiB')
        size += length
        if (length) continue
      }
      yield Buffer.from(buffer.subarray(0, size))
      used = 0
      size = 5
    }
  }
  if (used) throw new Error('Truncated exec frame')
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
