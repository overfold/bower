import { WebSocket, createWebSocketStream } from 'ws'
import { MAX_PAYLOAD } from './protocol.mjs'

export function openExec(connection, signal) {
  return new Promise((resolve, reject) => {
    const url = new URL(connection.url)
    // Never send workload credentials over a remote plaintext connection.
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      reject(new Error('Exec requires HTTPS'))
      return
    }
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(url, 'trellis.exec.v1', {
      headers: connection.headers, rejectUnauthorized: true,
      ...(connection.ca ? { ca: connection.ca } : {}),
      handshakeTimeout: 10000, maxPayload: MAX_PAYLOAD + 1, perMessageDeflate: false,
      followRedirects: false,
    })
    // Readable object mode preserves message boundaries and limits read-ahead
    // to one message. Text messages remain strings and are rejected by decodeFrame.
    const stream = createWebSocketStream(ws, { readableObjectMode: true, readableHighWaterMark: 1 })
    stream.on('error', reject)
    const abort = () => { reject(new Error('Exec aborted')); stream.destroy() }
    signal?.addEventListener('abort', abort, { once: true })
    stream.once('close', () => signal?.removeEventListener('abort', abort))
    ws.once('open', () => resolve(stream))
    ws.once('unexpected-response', (_request, response) => {
      reject(new Error(`Trellis refused exec (HTTP ${response.statusCode})`))
      response.destroy()
      stream.destroy()
    })
    if (signal?.aborted) abort()
  })
}
