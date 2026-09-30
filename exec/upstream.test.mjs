import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { openExec } from './upstream.mjs'
import { readFrames } from './protocol.mjs'

test('requires HTTPS before transmitting remote credentials', async () => {
  await assert.rejects(openExec({ url: 'http://trellis.example.test/exec', headers: { Authorization: 'Bearer fixture' } }), /HTTPS/)
})

test('refused and wrong-protocol upgrades fail, while upgrade head preserves initial output', async (t) => {
  const peers = []
  const server = http.createServer()
  server.on('upgrade', (request, socket) => {
    peers.push(socket)
    socket.on('error', () => {})
    if (request.url === '/denied') { socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); return }
    const protocol = request.url === '/wrong' ? 'another-protocol' : 'trellis-exec.v1'
    // Header and initial frame in one write exercises Node's upgrade head.
    socket.end(Buffer.concat([Buffer.from(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: ${protocol}\r\n\r\n`), Buffer.from([4, 0, 0, 0, 2, 0xff, 0])]))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { peers.forEach((peer) => peer.destroy()); server.close() })
  const headers = { Connection: 'Upgrade', Upgrade: 'trellis-exec.v1' }
  const url = `http://127.0.0.1:${server.address().port}`
  await assert.rejects(openExec({ url: `${url}/denied`, headers }), /HTTP 403/)
  await assert.rejects(openExec({ url: `${url}/wrong`, headers }), /Invalid.*upgrade/)
  const socket = await openExec({ url: `${url}/good`, headers })
  const result = await Array.fromAsync(readFrames(socket))
  assert.deepEqual(result, [Buffer.from([4, 0, 0, 0, 2, 0xff, 0])])
})
