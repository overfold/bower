import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'

test('front and supervised server share file configuration and process-environment precedence', { timeout: 15000 }, async (t) => {
  for (const override of [undefined, 'http://process-origin.fixture']) {
    const directory = await mkdtemp(join(tmpdir(), 'bower-front-'))
    const reservation = http.createServer()
    reservation.listen(0, '127.0.0.1')
    await once(reservation, 'listening')
    const port = reservation.address().port
    await new Promise((resolve) => reservation.close(resolve))
    await writeFile(join(directory, '.env.production.local'), 'BOWER_PUBLIC_URL=http://file-origin.fixture\n')
    // A controlled standalone child exercises front-server startup and its
    // private authorization request without a database or Trellis credential.
    await writeFile(join(directory, 'server.js'), `
      const http = require('node:http'); let checks = 0;
      http.createServer((req, res) => {
        if (req.url === '/api/exec/context') {
          if (req.headers['x-bower-exec-secret'] === process.env.BOWER_EXEC_INTERNAL_SECRET) checks++;
          req.resume(); res.writeHead(403); res.end(); return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ origin: process.env.BOWER_PUBLIC_URL, port: process.env.PORT, host: process.env.HOSTNAME, checks }));
      }).listen(Number(process.env.PORT), process.env.HOSTNAME);
    `)
    const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port) }
    delete env.BOWER_PUBLIC_URL
    delete env.__NEXT_PROCESSED_ENV
    if (override) env.BOWER_PUBLIC_URL = override
    const child = spawn(process.execPath, [resolve('exec/server.mjs')], { cwd: directory, env, stdio: 'ignore' })
    t.after(async () => {
      if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited }
      await rm(directory, { recursive: true, force: true })
    })
    const base = `http://127.0.0.1:${port}`
    let observed
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch(`${base}/probe`, { signal: AbortSignal.timeout(500) })
        if (response.ok) { observed = await response.json(); break }
      } catch {}
      await delay(20)
    }
    assert.ok(observed, 'supervised server must start')
    const origin = override ?? 'http://file-origin.fixture'
    assert.deepEqual(observed, { origin, port: String(port + 1), host: '127.0.0.1', checks: 0 })
    async function rejected(requestOrigin) {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`${base.replace('http:', 'ws:')}/api/exec/stream?serviceConfigId=c&allocationId=a&cols=93&rows=27`, {
          headers: { Origin: requestOrigin, Cookie: 'bower_session=fixture' }, handshakeTimeout: 3000,
        })
        ws.on('error', () => {})
        ws.once('open', () => { ws.terminate(); reject(new Error('Fixture authorization must deny')) })
        ws.once('unexpected-response', (_, response) => {
          try { assert.equal(response.statusCode, 403); ws.terminate(); resolve() } catch (error) { reject(error) }
        })
      })
    }
    await rejected(origin)
    assert.equal((await (await fetch(`${base}/probe`)).json()).checks, 1, 'configured origin must reach authorization despite rewritten Host')
    await rejected(override ? 'http://file-origin.fixture' : base)
    assert.equal((await (await fetch(`${base}/probe`)).json()).checks, 1, 'unconfigured origin must fail before authorization')
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
  }
})
