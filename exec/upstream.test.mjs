import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { WebSocketServer } from 'ws'
import { openExec } from './upstream.mjs'
import { decodeFrame } from './protocol.mjs'

test('requires HTTPS before transmitting remote credentials', async () => {
  await assert.rejects(openExec({ url: 'http://trellis.example.test/exec', headers: { Authorization: 'Bearer fixture' } }), /HTTPS/)
})

test('refused and wrong-subprotocol upgrades fail; immediate fragmented messages retain boundaries', async (t) => {
  const server = http.createServer()
  const wss = new WebSocketServer({ noServer: true, handleProtocols: (_protocols, request) => request.url === '/wrong' ? 'another-protocol' : 'trellis.exec.v1' })
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/denied') { socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); return }
    assert.equal(request.headers.upgrade, 'websocket')
    assert.equal(request.headers['sec-websocket-protocol'], 'trellis.exec.v1')
    assert.equal(request.headers.authorization, 'Bearer fixture')
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.on('error', () => {})
      if (request.url === '/text') { ws.send('\u0004not binary'); ws.close(); return }
      ws.send(Buffer.from([4, 0xff]), { fin: false })
      ws.send(Buffer.from([0]), { fin: true })
      ws.send(Buffer.from([6, ...Buffer.from('{"exit_code":0}')]))
      ws.close()
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { for (const ws of wss.clients) ws.terminate(); wss.close(); server.close() })
  const headers = { Authorization: 'Bearer fixture' }
  const url = `http://127.0.0.1:${server.address().port}`
  await assert.rejects(openExec({ url: `${url}/denied`, headers }), /HTTP 403/)
  await assert.rejects(openExec({ url: `${url}/wrong`, headers }), /subprotocol/)
  const stream = await openExec({ url: `${url}/good`, headers })
  const result = await Array.fromAsync(stream)
  assert.deepEqual(result, [Buffer.from([4, 0xff, 0]), Buffer.from([6, ...Buffer.from('{"exit_code":0}')])])
  stream.destroy()
  const text = await openExec({ url: `${url}/text`, headers })
  const textFrames = await Array.fromAsync(text)
  assert.deepEqual(textFrames, ['\u0004not binary'])
  assert.throws(() => decodeFrame(textFrames[0]), /binary/)
  text.destroy()
})

test('aborting a pending handshake closes upstream', { timeout: 3000 }, async (t) => {
  const server = http.createServer()
  const upgraded = once(server, 'upgrade')
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const controller = new AbortController()
  const pending = openExec({ url: `http://127.0.0.1:${server.address().port}/exec` }, controller.signal)
  const [, socket] = await upgraded
  socket.once('end', () => socket.destroy())
  socket.resume()
  t.after(() => socket.destroy())
  const closed = once(socket, 'close')
  controller.abort()
  await assert.rejects(pending, /aborted/)
  await closed
})
