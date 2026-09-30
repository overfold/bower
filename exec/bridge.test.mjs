import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'
import { createExecBridge } from './bridge.mjs'
import { encodeFrame, decodeFrame, readFrames } from './protocol.mjs'

async function fixture(t, options = {}) {
  const peers = []
  const upstream = http.createServer()
  upstream.on('upgrade', (request, socket, head) => {
    assert.equal(request.headers.upgrade, 'trellis-exec.v1')
    assert.equal(request.headers.authorization, 'Bearer fixture-only')
    assert.equal(request.url, '/exec')
    socket.on('error', () => {})
    socket.on('end', () => socket.destroy())
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: trellis-exec.v1\r\n\r\n')
    if (head.length) socket.unshift(head)
    peers.push(socket)
    options.onUpstream?.(socket)
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const connection = { url: `http://127.0.0.1:${upstream.address().port}/exec`, headers: { Authorization: 'Bearer fixture-only', Connection: 'Upgrade', Upgrade: 'trellis-exec.v1' } }
  const bridge = createExecBridge({ allowedOrigin: () => 'http://bower.test',
    authorize: options.authorize ?? (async (_cookie, _input, check) => {
      if (check && options.rejectCheck) throw new Error('Session expired')
      return connection
    }), checkInterval: options.checkInterval ?? 15000, maxStreams: options.maxStreams ?? 256 })
  const front = http.createServer()
  front.on('upgrade', (req, socket, head) => { void bridge.upgrade(req, socket, head) })
  front.listen(0, '127.0.0.1')
  await once(front, 'listening')
  t.after(() => { bridge.close(); peers.forEach((peer) => peer.destroy()); front.close(); upstream.close() })
  function connect(headers = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${front.address().port}/api/exec/stream?serviceConfigId=c&allocationId=a&cols=93&rows=27`, {
      headers: { Origin: 'http://bower.test', Cookie: 'bower_session=test-session', ...headers },
    })
    const messages = []
    ws.on('message', (data) => messages.push(decodeFrame(data)))
    ws.on('error', () => {})
    return { ws, messages }
  }
  return { bridge, peers, connect }
}

async function until(condition) {
  for (let count = 0; count < 100; count++) { if (condition()) return; await delay(10) }
  assert.fail('Timed out waiting for fixture condition')
}

test('one-frame output credit preserves raw data; input/resize/EOF; nonzero exit', async (t) => {
  const f = await fixture(t)
  const { ws, messages } = f.connect()
  await once(ws, 'open')
  const input = []
  const reading = (async () => { for await (const frame of readFrames(f.peers[0])) input.push(decodeFrame(frame)) })().catch(() => {})
  f.peers[0].write(Buffer.concat([encodeFrame(4, Buffer.from([0, 0xff, 0xe2, 0x82])), encodeFrame(5, Buffer.from([0xac])), encodeFrame(6, '{"exit_code":23}')]))
  await until(() => messages.length === 1)
  await delay(40)
  assert.equal(messages.length, 1, 'must not read next output until browser acknowledges render')
  ws.send(encodeFrame(1, Buffer.from([0x1b, 0, 0xff])))
  ws.send(encodeFrame(3, '{"cols":93,"rows":27}'))
  ws.send(encodeFrame(2))
  await until(() => input.length === 3)
  assert.deepEqual(input, [{ type: 1, payload: Buffer.from([0x1b, 0, 0xff]) }, { type: 3, payload: Buffer.from('{"cols":93,"rows":27}') }, { type: 2, payload: Buffer.alloc(0) }])
  ws.send(encodeFrame(8))
  await until(() => messages.length === 2)
  ws.send(encodeFrame(8))
  await until(() => messages.length === 3)
  assert.deepEqual(messages, [{ type: 4, payload: Buffer.from([0, 0xff, 0xe2, 0x82]) }, { type: 5, payload: Buffer.from([0xac]) }, { type: 6, payload: Buffer.from('{"exit_code":23}') }])
  await until(() => f.bridge.size === 0)
  await reading
})

test('Trellis error distinct from premature EOF, wrong direction and malformed statuses', async (t) => {
  for (const [frame, expected] of [[encodeFrame(7, '{"message":"task stopped"}'), 7], [null, 10], [encodeFrame(1, 'bad'), 10], [encodeFrame(6, '{"exit_code":"0"}'), 10], [encodeFrame(7, 'no JSON'), 10], [Buffer.from([4, 0, 0, 0x80, 1]), 10]]) {
    const f = await fixture(t)
    const { ws, messages } = f.connect()
    await once(ws, 'open')
    f.peers[0].end(frame)
    await until(() => messages.length > 0)
    assert.equal(messages[0].type, expected)
    await until(() => f.bridge.size === 0)
  }
})

test('clean zero exit remains exit, not a transport error', async (t) => {
  const f = await fixture(t)
  const { ws, messages } = f.connect()
  await once(ws, 'open')
  f.peers[0].end(Buffer.from([6, 0, 0, 0, 15, ...Buffer.from('{"exit_code":0}')]))
  await until(() => messages.length === 1)
  assert.equal(messages[0].type, 6)
  assert.equal(JSON.parse(messages[0].payload).exit_code, 0)
  await until(() => f.bridge.size === 0)
})

test('browser disconnect during authorization cancels pending open without starting exec', async (t) => {
  let signal
  const f = await fixture(t, { authorize: async (_cookie, _input, _check, abort) => {
    signal = abort
    await once(abort, 'abort')
    throw new Error('cancelled')
  } })
  const { ws } = f.connect()
  await until(() => signal !== undefined)
  ws.terminate()
  await until(() => signal.aborted && f.bridge.size === 0)
  assert.equal(f.peers.length, 0)
})

test('missing cookie, foreign origin, failed authorization and stream limits reject before exec', async (t) => {
  const f = await fixture(t, { maxStreams: 0 })
  for (const [headers, status] of [[{ Cookie: '' }, 403], [{ Origin: 'https://evil.test' }, 403], [{}, 429]]) {
    const { ws } = f.connect(headers)
    const response = once(ws, 'unexpected-response')
    const [, res] = await response
    assert.equal(res.statusCode, status)
    ws.terminate()
  }
  assert.equal(f.peers.length, 0)
  const denied = await fixture(t, { authorize: async () => { throw new Error('viewer') } })
  const { ws } = denied.connect()
  const [, res] = await once(ws, 'unexpected-response')
  assert.equal(res.statusCode, 403)
  ws.terminate()
  assert.equal(denied.peers.length, 0)
})

test('browser close, session revoke, server shutdown and failed recheck destroy upstream', { timeout: 5000 }, async (t) => {
  for (const mode of ['browser', 'revoke', 'server', 'recheck']) {
    const f = await fixture(t, mode === 'recheck' ? { checkInterval: 20, rejectCheck: true } : {})
    const { ws } = f.connect()
    await once(ws, 'open')
    // A controlled agent must read EOF to observe the bridge disconnect.
    f.peers[0].resume()
    const ended = once(f.peers[0], 'close')
    if (mode === 'browser') ws.close()
    else if (mode === 'server') f.bridge.close()
    else if (mode === 'revoke') f.bridge.revoke('test-session')
    await ended
    await until(() => f.bridge.size === 0)
  }
})

test('input flood against a blocked upstream is bounded and kills the process', { timeout: 5000 }, async (t) => {
  const f = await fixture(t, { onUpstream: (socket) => socket.pause() })
  const { ws, messages } = f.connect()
  await once(ws, 'open')
  const frame = encodeFrame(1, Buffer.alloc(32768, 0x61))
  for (let count = 0; count < 1000 && ws.readyState === WebSocket.OPEN; count++) ws.send(frame)
  await until(() => messages.some((message) => message.type === 10))
  assert.match(messages.find((message) => message.type === 10).payload.toString(), /buffer exceeded/)
  await until(() => f.bridge.size === 0)
})
