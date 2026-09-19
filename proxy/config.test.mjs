import assert from 'node:assert/strict'
import test from 'node:test'
import { renderBootstrapCaddyfile, renderCaddyfile } from './config.mjs'

const allocation = {
  phase: 'running',
  health: 'healthy',
  job: 'web',
  address: '10.0.0.2',
  ports: [{ port: 8080, host_port: 32100 }],
}

const route = {
  id: 'route-id',
  domain: 'preview.example.com',
  pathPrefix: '/',
  port: 8080,
  tlsMode: 'auto',
  service: 'web',
  activeJob: 'web',
  strategy: 'rolling',
}

test('routes password protection through Bower before the deployment upstream', () => {
  const config = renderCaddyfile([{ ...route, protectionMode: 'password', authOrigin: 'https://bower.example.com' }], [allocation])
  assert.match(config, /forward_auth https:\/\/bower\.example\.com \{\n      uri \/api\/route-auth\/verify\/route-id/)
  assert.doesNotMatch(config, /basic_auth/)
  assert.ok(config.indexOf('forward_auth') < config.indexOf('reverse_proxy 10.0.0.2:32100'))
})

test('renders Bower forward auth and a callback outside the protected handler', () => {
  const config = renderCaddyfile([{ ...route, protectionMode: 'bower_auth', authOrigin: 'https://bower.example.com' }], [allocation])
  assert.match(config, /handle \/\.bower\/auth\/callback \{[\s\S]*rewrite \/api\/route-auth\/callback/)
  assert.match(config, /forward_auth https:\/\/bower\.example\.com \{\n      uri \/api\/route-auth\/verify\/route-id/)
  assert.ok(config.indexOf('handle /.bower/auth/callback') < config.indexOf('  handle {'))
})

test('leaves public routes unprotected', () => {
  const config = renderCaddyfile([{ ...route, protectionMode: 'none' }], [allocation])
  const siteBlock = config.slice(config.indexOf('preview.example.com'))
  assert.doesNotMatch(siteBlock, /basic_auth|forward_auth|\.bower\/auth/)
})


test('renders the no-route fallback as a multiline Caddy site block', () => {
  const config = renderCaddyfile([], [], { httpPort: '8080' })
  assert.match(config, /:8080 \{\n  respond "Bower proxy ready" 200\n\}$/)
})


test('bootstrap config exposes known routes as unavailable without auth', () => {
  const config = renderBootstrapCaddyfile([
    { ...route, protectionMode: 'password', authOrigin: 'https://bower.example.com' },
  ])
  assert.match(config, /preview\.example\.com \{/)
  assert.match(config, /respond "No healthy upstream allocations" 503/)
  assert.doesNotMatch(config, /forward_auth|\.bower\/auth\/callback/)
  assert.doesNotMatch(config, /Bower proxy is discovering routes/)
})

test('bootstrap config preserves custom TLS so HTTPS can start before discovery', () => {
  const config = renderBootstrapCaddyfile([{
    ...route,
    tlsMode: 'custom',
    tlsCertSecret: 'route-cert',
    tlsKeySecret: 'route-key',
  }])
  assert.match(config, /tls \/run\/trellis-secrets\/route-cert \/run\/trellis-secrets\/route-key/)
})


test('binds the Caddy admin API to loopback for route-sync reloads', () => {
  const config = renderCaddyfile([{ ...route, protectionMode: 'none' }], [allocation], { adminPort: '22909' })
  assert.match(config, /admin 127\.0\.0\.1:22909/)
  assert.doesNotMatch(config, /admin 0\.0\.0\.0:/)
})
