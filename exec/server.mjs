// A small streaming front server, not a custom Next server. Next's own dev,
// production, or generated standalone server runs unchanged on loopback.
import http from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import nextEnv from '@next/env'
import { createExecBridge } from './bridge.mjs'

const dev = process.argv.includes('--dev')
nextEnv.loadEnvConfig(process.cwd(), dev)
const port = Number(process.env.PORT || 3000)
const internalPort = port + 1
const secret = randomBytes(32).toString('hex')
const internal = `http://127.0.0.1:${internalPort}`
const args = !dev && existsSync('server.js') ? ['server.js']
  : ['node_modules/next/dist/bin/next', dev ? 'dev' : 'start', '--hostname', '127.0.0.1', '--port', String(internalPort)]
const child = spawn(process.execPath, args, { stdio: 'inherit', env: {
  ...process.env, PORT: String(internalPort), HOSTNAME: '127.0.0.1',
  BOWER_EXEC_INTERNAL_SECRET: secret, BOWER_EXEC_BRIDGE_URL: `http://127.0.0.1:${port}`,
} })

const bridge = createExecBridge({
  allowedOrigin(request) {
    if (process.env.BOWER_PUBLIC_URL) return new URL(process.env.BOWER_PUBLIC_URL).origin
    // Browsers cannot forge Host; don't trust user-supplied forwarded headers.
    try {
      const origin = new URL(request.headers.origin)
      return ['http:', 'https:'].includes(origin.protocol) && origin.host === request.headers.host ? origin.origin : null
    } catch { return null }
  },
  async authorize(cookie, input, check, signal) {
    const result = await fetch(`${internal}/api/exec/context`, {
      method: 'POST', headers: { cookie, 'Content-Type': 'application/json', 'x-bower-exec-secret': secret },
      body: JSON.stringify({ ...input, check }), redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    })
    if (!result.ok) throw new Error('Terminal access denied')
    return result.json()
  },
})

const server = http.createServer(async (request, response) => {
  let url
  try { url = new URL(request.url, internal) } catch { response.writeHead(400).end(); return }
  const path = url.pathname
  if (path === '/_bower/exec/revoke') {
    const supplied = Buffer.from(request.headers['x-bower-exec-secret'] || '')
    if (request.method !== 'POST' || supplied.length !== secret.length || !timingSafeEqual(supplied, Buffer.from(secret))) {
      response.writeHead(404).end(); return
    }
    let token = ''
    try {
      for await (const chunk of request) {
        token += chunk.toString()
        if (token.length > 1024) { response.writeHead(413).end(); return }
      }
    } catch { response.destroy(); return }
    bridge.revoke(token)
    response.writeHead(204).end()
    return
  }
  if (path === '/api/exec/context' || path === '/api/exec/stream') { response.writeHead(404).end(); return }
  const headers = { ...request.headers }
  delete headers['x-bower-exec-secret']
  const upstream = http.request(`${internal}${url.pathname}${url.search}`, { method: request.method, headers }, (res) => {
    response.writeHead(res.statusCode, res.headers)
    res.pipe(response)
  })
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end() })
  response.on('close', () => upstream.destroy())
  request.pipe(upstream)
})

server.on('upgrade', (request, socket, head) => {
  let url
  try { url = new URL(request.url, internal) } catch { socket.destroy(); return }
  const path = url.pathname
  if (path === '/api/exec/stream') { void bridge.upgrade(request, socket, head); return }
  if (!dev || path !== '/_next/webpack-hmr') { socket.destroy(); return }
  // Preserve the stock development server's HMR WebSocket.
  const upstream = http.request(`${internal}${url.pathname}${url.search}`, { headers: request.headers })
  upstream.on('error', () => socket.destroy())
  upstream.on('upgrade', (res, peer, initial) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(res.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`)
    if (head.length) peer.write(head)
    if (initial.length) socket.write(initial)
    socket.pipe(peer).pipe(socket)
    socket.on('close', () => peer.destroy())
    socket.on('error', () => peer.destroy())
    peer.on('close', () => socket.destroy())
    peer.on('error', () => socket.destroy())
  })
  upstream.end()
})

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  bridge.close()
  server.close()
  child.kill('SIGTERM')
  setTimeout(() => process.exit(process.exitCode || 0), 3000).unref()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
server.on('error', (error) => { console.error('Bower front server failed:', error.message); stop(); process.exitCode = 1 })
child.on('error', (error) => { console.error('Next server failed:', error.message); stop(); process.exitCode = 1 })
child.on('exit', (code) => { if (code) process.exitCode = code; stop() })
server.listen(port, process.env.HOSTNAME || '0.0.0.0', () => console.log(`Bower front server listening on port ${port}`))
