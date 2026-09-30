import { WebSocketServer, WebSocket } from 'ws'
import { once } from 'node:events'
import { decodeFrame, encodeFrame, readFrames, validateInput, MAX_PAYLOAD } from './protocol.mjs'
import { openExec } from './upstream.mjs'

// Browser protocol: one complete Trellis frame per binary WebSocket message.
// Type 8 (empty) acknowledges rendered output; type 10 is a bridge/transport
// error, deliberately distinct from Trellis type 7 and process exit type 6.
export function createExecBridge({ authorize, allowedOrigin, maxStreams = 256, checkInterval = 15000 }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD + 5, perMessageDeflate: false })
  const streams = new Set()

  function revoke(token) {
    for (const stream of streams) if (stream.token === token) stream.stop()
  }

  async function upgrade(request, socket, head) {
    const fail = (status) => { if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`) }
    let url
    try { url = new URL(request.url, 'http://bridge') } catch { return fail('400 Bad Request') }
    socket.on('error', () => socket.destroy())
    if (head.length) return fail('400 Bad Request')
    const cookie = request.headers.cookie ?? ''
    const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('bower_session='))?.slice(14)
    if (!token || request.headers.origin !== allowedOrigin(request) || url.pathname !== '/api/exec/stream') return fail('403 Forbidden')
    if (streams.size >= maxStreams || [...streams].filter((stream) => stream.token === token).length >= 8) return fail('429 Too Many Requests')
    const input = {
      serviceConfigId: url.searchParams.get('serviceConfigId'), allocationId: url.searchParams.get('allocationId'),
      task: url.searchParams.get('task') || undefined, cols: Number(url.searchParams.get('cols')), rows: Number(url.searchParams.get('rows')),
    }
    const abort = new AbortController()
    let upstream
    let ws
    let timer
    let ack
    let closed = false
    let failing = false
    const stream = { token, stop }
    streams.add(stream)
    const onSocketClose = () => stop()
    socket.once('close', onSocketClose)
    socket.once('end', onSocketClose)
    // A browser sends no WebSocket data before 101. Read to detect a FIN while
    // authorization/exec admission is pending; reject any premature payload.
    socket.on('data', onSocketClose)
    socket.resume()
    function stop() {
      if (closed) return
      closed = true
      streams.delete(stream)
      clearTimeout(timer)
      abort.abort()
      upstream?.destroy()
      ack?.reject(new Error('Terminal disconnected'))
      ack = null
      ws?.terminate()
      if (!ws) socket.destroy()
    }
    function send(frame) {
      return new Promise((resolve, reject) => ws.send(frame, { binary: true }, (error) => error ? reject(error) : resolve()))
    }
    async function report(error) {
      if (closed || failing) return
      failing = true
      try { await send(encodeFrame(10, JSON.stringify({ message: error.message || 'Terminal transport failed' }))) } catch {}
      stop()
    }
    try {
      const connection = await authorize(cookie, input, false, abort.signal)
      if (closed) return
      upstream = await openExec(connection, abort.signal)
      if (closed) { upstream.destroy(); return }
      // Install an error listener before any async processing of upgraded data.
      upstream.on('error', (error) => { void report(error) })
      socket.pause()
      socket.removeListener('data', onSocketClose)
      wss.handleUpgrade(request, socket, head, (client) => { ws = client })
      if (!ws) { stop(); return }
      socket.removeListener('close', onSocketClose)
      socket.removeListener('end', onSocketClose)
      ws.on('close', stop)
      ws.on('error', stop)
      socket.resume()
      let pendingBytes = 0
      let writes = Promise.resolve()
      ws.on('message', (data, binary) => {
        if (closed || failing) return
        try {
          if (!binary) throw new Error('Terminal requires binary frames')
          const frame = Buffer.from(data)
          const decoded = decodeFrame(frame)
          if (decoded.type === 8 && decoded.payload.length === 0 && ack) {
            ack.resolve(); ack = null; return
          }
          validateInput(frame)
          pendingBytes += frame.length
          if (pendingBytes > 4 * (MAX_PAYLOAD + 5)) throw new Error('Terminal input buffer exceeded')
          writes = writes.then(async () => {
            if (closed) return
            if (!upstream.write(frame)) await once(upstream, 'drain', { signal: abort.signal })
            pendingBytes -= frame.length
          }).catch(report)
        } catch (error) { void report(error) }
      })
      const recheck = async () => {
        try {
          await authorize(cookie, input, true, abort.signal)
          if (closed) return
          timer = setTimeout(recheck, checkInterval)
          ws.ping()
        } catch { stop() }
      }
      // Detect half-open browsers independently of output/ack activity.
      let alive = true
      ws.on('pong', () => { alive = true })
      const heartbeat = setInterval(() => {
        if (!alive) return stop()
        alive = false
        ws.ping()
      }, 15000)
      const lifetime = setTimeout(stop, 8 * 60 * 60 * 1000)
      ws.once('close', () => { clearInterval(heartbeat); clearTimeout(lifetime) })
      timer = setTimeout(recheck, checkInterval)
      for await (const frame of readFrames(upstream)) {
        const { type, payload } = decodeFrame(frame)
        if (type === 4 || type === 5) {
          let ackTimer
          const rendered = new Promise((resolve, reject) => {
            ack = { resolve, reject }
            ackTimer = setTimeout(() => reject(new Error('Terminal output stalled')), 30000)
          })
          try { await send(frame); await rendered } finally { clearTimeout(ackTimer) }
        } else if (type === 6 || type === 7) {
          const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))
          if (type === 6 ? !Number.isInteger(value.exit_code) : typeof value.message !== 'string') throw new Error('Malformed exec status')
          await send(frame)
          upstream.destroy()
          ws.close(1000)
          return
        } else throw new Error('Unexpected Trellis exec frame')
      }
      throw new Error('Exec stream ended without an exit status')
    } catch (error) {
      if (ws?.readyState === WebSocket.OPEN) await report(error)
      else { fail('403 Forbidden'); stop() }
    }
  }

  return { upgrade, revoke, close() { for (const stream of streams) stream.stop(); wss.close() }, get size() { return streams.size } }
}
