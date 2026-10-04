import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises'
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
    const env = { ...process.env, AUTO_MIGRATE: 'false', NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port) }
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

// Exercise the actual startup and retry loop in a subprocess. Only database
// migration I/O and retry time are controlled; the web child is a fixture.
async function migrationStartup(t, failureCode = '') {
  const directory = await mkdtemp(join(tmpdir(), 'bower-migration-start-'))
  const reservation = http.createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  await writeFile(join(directory, 'server.js'), `
    require('node:fs').writeFileSync('web-started', 'yes');
    require('node:http').createServer((req, res) => res.end('ready'))
      .listen(Number(process.env.PORT), process.env.HOSTNAME);
  `)
  await writeFile(join(directory, 'loader.mjs'), `
    const migration = ${JSON.stringify(`
      import { existsSync } from 'node:fs';
      export async function migrate() {
        if (existsSync('db-ready')) return;
        throw new Error('Failed query', { cause: Object.assign(new Error('Fixture failure'), {
          code: process.env.FIXTURE_FAILURE_CODE || 'ENOTFOUND'
        }) });
      }
    `)};
    export async function resolve(specifier, context, nextResolve) {
      let source;
      if (specifier === 'drizzle-orm/postgres-js/migrator') source = migration;
      if (specifier === 'node:timers/promises' && context.parentURL.endsWith('/exec/migrate.mjs')) {
        source = 'export const setTimeout = () => new Promise(resolve => globalThis.setTimeout(resolve, 10));';
      }
      if (source) return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
      return nextResolve(specifier, context);
    }
  `)
  const env = {
    ...process.env, NODE_ENV: 'production', AUTO_MIGRATE: 'true',
    DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1:1/fixture',
    PORT: String(port), HOSTNAME: '127.0.0.1', FIXTURE_FAILURE_CODE: failureCode,
  }
  delete env.__NEXT_PROCESSED_ENV
  const child = spawn(process.execPath, ['--experimental-loader', join(directory, 'loader.mjs'), resolve('exec/server.mjs')], {
    cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  const exited = once(child, 'exit')
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await exited
    await rm(directory, { recursive: true, force: true })
  })
  async function waitFor(predicate) {
    for (let i = 0; i < 300; i++) {
      if (predicate(output)) return
      if (child.exitCode !== null || child.signalCode !== null) break
      await delay(10)
    }
    assert.fail(`Startup did not reach expected state:\n${output}`)
  }
  return { directory, port, child, exited, waitFor, output: () => output }
}

test('startup stays unready beyond ten failures and launches the web server only after migration success', { timeout: 10000 }, async t => {
  const startup = await migrationStartup(t)
  await startup.waitFor(output => output.includes('attempt 12)'))
  await assert.rejects(access(join(startup.directory, 'web-started')))
  await assert.rejects(fetch(`http://127.0.0.1:${startup.port}`, { signal: AbortSignal.timeout(500) }))
  await writeFile(join(startup.directory, 'db-ready'), '')
  await startup.waitFor(output => output.includes('Bower front server listening'))
  for (let i = 0; i < 100; i++) {
    const response = await fetch(`http://127.0.0.1:${startup.port}`)
    if (response.ok) {
      assert.equal(await response.text(), 'ready')
      assert.ok(startup.output().indexOf('Migrations complete.') < startup.output().indexOf('Bower front server listening'))
      return
    }
    await delay(10)
  }
  assert.fail('Web server did not become ready after database recovery')
})

test('authentication and SQL failures exit nonzero without launching the web server', { timeout: 10000 }, async t => {
  for (const code of ['28P01', '42601']) {
    const startup = await migrationStartup(t, code)
    const [exitCode] = await startup.exited
    assert.equal(exitCode, 1)
    assert.match(startup.output(), /Migration failed:/)
    assert.ok(!startup.output().includes('retrying'))
    await assert.rejects(access(join(startup.directory, 'web-started')))
  }
})

test('SIGTERM and SIGINT stop startup promptly while waiting for the database', { timeout: 10000 }, async t => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const startup = await migrationStartup(t)
    await startup.waitFor(output => output.includes('retrying'))
    startup.child.kill(signal)
    assert.deepEqual(await startup.exited, [null, signal])
    await assert.rejects(access(join(startup.directory, 'web-started')))
  }
})
