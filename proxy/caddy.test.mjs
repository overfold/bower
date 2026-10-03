import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket, WebSocketServer } from 'ws'
import { renderCaddyfile } from './config.mjs'
import { loadCaddyConfig } from './caddy-api.mjs'

// Run with CADDY_BINARY set and permission to bind port 80. Ordinary unit test
// runs do not require installing Caddy or taking ownership of a host port.
test('real Caddy serves port 80 across namespaces, forwards WebSockets, and retains dashboard', {
  skip: !process.env.CADDY_BINARY, timeout: 15_000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-ingress-e2e-'))
  const servers = []
  let caddy
  let sockets
  t.after(async () => {
    if (caddy && caddy.exitCode === null) {
      const exited = new Promise((resolve) => caddy.once('exit', resolve))
      caddy.kill('SIGTERM')
      await exited
    }
    for (const socket of sockets?.clients || []) socket.terminate()
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))))
    await rm(directory, { recursive: true, force: true })
  })
  for (const name of ['dashboard', 'team-a', 'team-b']) {
    const server = http.createServer((_, response) => response.end(name))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    servers.push(server)
  }
  sockets = new WebSocketServer({ server: servers[0] })
  sockets.on('connection', (socket) => socket.on('message', (data) => socket.send(data)))
  const allocations = servers.map((server, index) => ({
    namespace: ['platform', 'team-a', 'team-b'][index], job: index ? 'web' : 'bower',
    phase: 'running', health: 'healthy',
    endpoints: [{ task: index ? 'web' : 'bower', address: '127.0.0.1',
      ports: [{ container_port: server.address().port, host_port: 32000 + index }],
    }],
  }))
  const routes = ['team-a', 'team-b'].map((namespace, index) => ({
    namespace, domain: `${namespace}.example.test`, pathPrefix: '/', port: servers[index + 1].address().port,
    tlsMode: 'none', activeJob: 'web',
  }))
  const options = { adminPort: '18019', dashboard: { address: ':80', namespace: 'platform', job: 'bower', port: servers[0].address().port } }
  const file = join(directory, 'Caddyfile')
  await writeFile(file, renderCaddyfile(routes, allocations, options))
  caddy = spawn(process.env.CADDY_BINARY, ['run', '--config', file, '--adapter', 'caddyfile'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, XDG_CONFIG_HOME: directory, XDG_DATA_HOME: directory },
  })
  let errors = ''
  caddy.stderr.on('data', (data) => { errors += data })
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://127.0.0.1:18019/config/')).ok) break } catch {}
    if (caddy.exitCode !== null) throw new Error(errors)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  for (const [hostname, expected] of [['unknown.example.test', 'dashboard'], ['team-a.example.test', 'team-a'], ['team-b.example.test', 'team-b']]) {
    const response = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:80/', { headers: { host: hostname } }, (result) => {
        let body = ''
        result.on('data', (chunk) => { body += chunk })
        result.on('end', () => resolve({ status: result.statusCode, body }))
      }).on('error', reject)
    })
    assert.equal(response.status, 200)
    assert.equal(response.body, expected)
  }
  const socket = new WebSocket('ws://127.0.0.1:80/api/exec/stream')
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  const echoed = new Promise((resolve) => socket.once('message', (data) => resolve(data.toString())))
  socket.send('terminal-fixture')
  assert.equal(await echoed, 'terminal-fixture')
  socket.close()
  await loadCaddyConfig('http://127.0.0.1:18019/load', renderCaddyfile([], allocations, options))
  assert.equal(await (await fetch('http://127.0.0.1:80/')).text(), 'dashboard')
})
