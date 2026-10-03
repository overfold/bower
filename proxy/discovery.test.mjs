import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import https from 'node:https'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchTrellisJson } from './trellis-api.mjs'

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

test('cluster/read agent queries only its environment allocations and marks health only after Caddy accepts config', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-discovery-'))
  const requests = []
  let loads = 0
  let allowLoads = false
  let markReload
  const firstReload = new Promise((resolve) => { markReload = resolve })
  const api = http.createServer((request, response) => {
    requests.push({ path: request.url, headers: request.headers })
    response.writeHead(request.url === '/v1/namespaces/project-production/allocations' ? 200 : 404)
    response.end(request.url === '/v1/namespaces/project-production/allocations' ? '[]' : 'unexpected resource path')
  })
  const caddy = http.createServer((request, response) => {
    request.resume()
    request.on('end', () => { loads++; response.writeHead(allowLoads ? 200 : 500); response.end(); markReload() })
  })
  const apiPort = await listen(api)
  const caddyPort = await listen(caddy)
  const healthFile = join(directory, 'healthy')
  const agent = spawn(process.execPath, ['proxy/agent.mjs'], {
    env: { ...process.env, TRELLIS_ADDR: `http://127.0.0.1:${apiPort}`, TRELLIS_TOKEN: 'cluster-read-fixture', TRELLIS_NAMESPACE: 'project-production', TRELLIS_CA_CERT: '', CADDY_ADMIN_URL: `http://127.0.0.1:${caddyPort}/load`, BOWER_ROUTES: '[]', BOWER_SYNC_HEALTH_FILE: healthFile, BOWER_SYNC_INTERVAL: '1' },
    stdio: 'ignore',
  })
  t.after(async () => {
    agent.kill()
    await Promise.all([new Promise((resolve) => api.close(resolve)), new Promise((resolve) => caddy.close(resolve))])
    await rm(directory, { recursive: true, force: true })
  })
  await Promise.race([firstReload, new Promise((_, reject) => setTimeout(() => reject(new Error('Agent did not reload Caddy')), 3000))])
  await new Promise((resolve) => setTimeout(resolve, 30))
  await assert.rejects(readFile(healthFile), { code: 'ENOENT' })
  allowLoads = true
  let health = ''
  for (let attempt = 0; attempt < 100 && !health; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 30))
    health = await readFile(healthFile, 'utf8').catch(() => '')
  }
  assert.match(health, /^\d+\n$/)
  assert.ok(loads > 1)
  assert.ok(requests.every(({ path }) => path === '/v1/namespaces/project-production/allocations'))
  assert.equal(requests[0].headers.authorization, 'Bearer cluster-read-fixture')
  assert.equal(requests[0].headers['x-trellis-namespace'], undefined)
})

test('agent discovers every route namespace and withholds reload and health if any discovery fails', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-shared-ingress-'))
  const requested = []
  const loaded = []
  let failSecondNamespace = true
  const api = http.createServer((request, response) => {
    requested.push(request.url)
    const namespace = request.url.split('/')[3]
    if (namespace === 'team-b' && failSecondNamespace) {
      response.writeHead(500); response.end('not ready'); return
    }
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify([{
      phase: 'running', health: 'healthy', job: 'web', address: namespace === 'team-a' ? '10.0.1.1' : '10.0.2.1',
      ports: [{ container_port: 8080, host_port: 32100 }],
    }]))
  })
  const caddy = http.createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => { loaded.push(body); response.end() })
  })
  const apiPort = await listen(api)
  const caddyPort = await listen(caddy)
  const healthFile = join(directory, 'healthy')
  const routes = ['team-a', 'team-b'].map((namespace) => ({
    id: namespace, namespace, domain: `${namespace}.example.com`, pathPrefix: '/', port: 8080,
    tlsMode: 'auto', service: 'web', activeJob: 'web', strategy: 'rolling',
  }))
  const agent = spawn(process.execPath, ['proxy/agent.mjs'], {
    env: { ...process.env, TRELLIS_ADDR: `http://127.0.0.1:${apiPort}`, TRELLIS_TOKEN: 'fixture', TRELLIS_NAMESPACE: 'fallback', TRELLIS_CA_CERT: '', CADDY_ADMIN_URL: `http://127.0.0.1:${caddyPort}/load`, BOWER_ROUTES: JSON.stringify(routes), BOWER_SYNC_HEALTH_FILE: healthFile, BOWER_SYNC_INTERVAL: '1' },
    stdio: 'ignore',
  })
  t.after(async () => {
    agent.kill()
    await Promise.all([new Promise((resolve) => api.close(resolve)), new Promise((resolve) => caddy.close(resolve))])
    await rm(directory, { recursive: true, force: true })
  })
  for (let attempt = 0; attempt < 100 && requested.length < 2; attempt++) await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(loaded.length, 0)
  await assert.rejects(readFile(healthFile), { code: 'ENOENT' })
  failSecondNamespace = false
  for (let attempt = 0; attempt < 100 && loaded.length === 0; attempt++) await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(loaded.length, 1)
  assert.match(loaded[0], /team-a\.example\.com \{[\s\S]*10\.0\.1\.1:32100/)
  assert.match(loaded[0], /team-b\.example\.com \{[\s\S]*10\.0\.2\.1:32100/)
  assert.doesNotMatch(loaded[0], /team-a\.example\.com \{[\s\S]*10\.0\.2\.1:32100[\s\S]*team-b\.example\.com/)
  assert.ok(requested.includes('/v1/namespaces/team-a/allocations'))
  assert.ok(requested.includes('/v1/namespaces/team-b/allocations'))
  assert.ok(!requested.includes('/v1/namespaces/fallback/allocations'))
  assert.match(await readFile(healthFile, 'utf8'), /^\d+\n$/)
})

test('HTTPS rejects an untrusted certificate and accepts the configured cluster CA', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-tls-'))
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')], { stdio: 'ignore' })
  const caCert = await readFile(join(directory, 'cert.pem'), 'utf8')
  const server = https.createServer({ key: await readFile(join(directory, 'key.pem')), cert: caCert }, (_, response) => response.end('[]'))
  const port = await listen(server)
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  await assert.rejects(fetchTrellisJson(`https://127.0.0.1:${port}`, '/v1/namespaces/production/allocations', { token: 'fixture' }), /self-signed certificate/)
  assert.deepEqual(await fetchTrellisJson(`https://127.0.0.1:${port}`, '/v1/namespaces/production/allocations', { token: 'fixture', caCert }), [])
})

test('entrypoint uses normal TLS verification when no injected CA is present', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-entrypoint-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, 'node'), '#!/bin/sh\nprintf "TLS=%s CA=%s\\n" "$NODE_TLS_REJECT_UNAUTHORIZED" "$NODE_EXTRA_CA_CERTS"\n', { mode: 0o755 })
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, TRELLIS_CA_CERT: '' }
  delete env.NODE_TLS_REJECT_UNAUTHORIZED
  delete env.NODE_EXTRA_CA_CERTS
  assert.equal(execFileSync('sh', ['entrypoint.sh'], { env, encoding: 'utf8' }), 'TLS= CA=\n')
  // Preserve support for operator-configured private CA material without injection.
  assert.equal(execFileSync('sh', ['entrypoint.sh'], { env: { ...env, NODE_EXTRA_CA_CERTS: '/operator/ca.pem' }, encoding: 'utf8' }), 'TLS= CA=/operator/ca.pem\n')
})

test('Caddy entrypoint uses revision-owned bootstrap config and can still start old secret-backed jobs', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bower-caddy-entrypoint-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, 'caddy'), '#!/bin/sh\nprintf "%s|%s|%s|%s\\n" "$1" "$2" "$4" "$5"\nif [ "$3" = /run/trellis-secrets/BOWER_CADDYFILE ]; then\n  printf "%s\\n" "$3"\nelse\n  cat "$3"\n  rm "$3"\nfi\n', { mode: 0o755 })
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, BOWER_CADDYFILE: ':80 {\n  respond "bootstrap fixture" 200\n}' }
  assert.equal(execFileSync('sh', ['proxy/caddy-entrypoint.sh'], { env, encoding: 'utf8' }), 'run|--config|--adapter|caddyfile\n:80 {\n  respond "bootstrap fixture" 200\n}\n')
  assert.equal(execFileSync('sh', ['proxy/caddy-entrypoint.sh'], { env: { ...env, BOWER_CADDYFILE: '' }, encoding: 'utf8' }), 'run|--config|--adapter|caddyfile\n/run/trellis-secrets/BOWER_CADDYFILE\n')
})
