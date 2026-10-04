import assert from 'node:assert/strict'
import test from 'node:test'
import { renderBootstrapCaddyfile, renderCaddyfile } from './config.mjs'

const allocation = {
  phase: 'running',
  health: 'healthy',
  job: 'web',
  address: '10.0.0.2',
  ports: [{ container_port: 8080, host_port: 32100 }],
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
  assert.match(config, /header_up X-Bower-Forwarded-Host \{http\.request\.host\}/)
  assert.match(config, /header_up X-Bower-Forwarded-Uri \{uri\}/)
  assert.match(config, /header_up X-Bower-Forwarded-Proto \{scheme\}/)
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

test('uses the Bower task endpoint and the configured route port, not published ports', () => {
  const config = renderCaddyfile([route], [{
    ...allocation,
    address: '',
    ports: [],
    endpoints: [
      { task: 'sidecar', address: '10.0.0.8', ports: [{ container_port: 8080, host_port: 39000 }] },
      { task: 'web', address: '10.0.0.9', ports: [{ container_port: 9090, host_port: 32080 }] },
    ],
  }])
  assert.match(config, /reverse_proxy 10\.0\.0\.9:8080/)
  assert.doesNotMatch(config, /10\.0\.0\.8|39000|32080|:9090/)
})

test('routes healthy Linkding namespace endpoints without published ports', () => {
  const linkdingRoute = { ...route, namespace: 'linkding-production', service: 'linkding', activeJob: 'linkding', port: 9090 }
  const linkding = {
    phase: 'running', health: 'healthy', job: 'linkding', namespace: 'linkding-production',
    address: '10.64.1.105', ports: null,
  }
  for (const ports of [undefined, [], null]) {
    const config = renderCaddyfile([linkdingRoute], [{
      ...linkding, endpoints: [{ task: 'linkding', address: '10.64.1.105', ports }],
    }])
    assert.match(config, /reverse_proxy 10\.64\.1\.105:9090/)
    assert.doesNotMatch(config, /No healthy upstream allocations/)
  }

  for (const overrides of [
    { endpoints: [{ task: 'linkding' }] },
    { endpoints: [{ task: 'other', address: '10.64.1.105' }] },
    { health: 'unhealthy' },
    { phase: 'starting' },
    { namespace: 'other-production' },
  ]) {
    const config = renderCaddyfile([linkdingRoute], [{
      ...linkding, endpoints: [{ task: 'linkding', address: '10.64.1.105' }], ...overrides,
    }])
    assert.match(config, /No healthy upstream allocations/)
    assert.doesNotMatch(config, /reverse_proxy/)
  }
})

test('does not invent a route for an unmatched port or ambiguous multi-task workload', () => {
  const unmatched = renderCaddyfile([route], [{ ...allocation, ports: [{ container_port: 9090, host_port: 32100 }] }])
  assert.match(unmatched, /No healthy upstream allocations/)

  const ambiguous = renderCaddyfile([{ ...route, strategy: 'canary' }], [{
    ...allocation,
    job: 'external',
    labels: { 'bower/service': 'web' },
    endpoints: [{ task: 'api', address: '10.0.0.8', ports: [{ container_port: 8080, host_port: 8080 }] }],
  }])
  assert.match(ambiguous, /No healthy upstream allocations/)
})

test('matches rolling and canary allocations only within the route namespace', () => {
  const duplicate = (namespace, address, labels) => ({
    ...allocation,
    namespace,
    address,
    labels,
  })
  const routes = [
    { ...route, namespace: 'team-a', domain: 'rolling.example.com' },
    { ...route, namespace: 'team-a', domain: 'canary.example.com', strategy: 'canary' },
  ]
  const config = renderCaddyfile(routes, [
    duplicate('team-a', '10.0.1.1'),
    duplicate('team-b', '10.0.2.1'),
    duplicate('team-a', '10.0.1.2', { 'bower/service': 'web', 'bower/canary': 'true', 'trellis/weight': '10' }),
    duplicate('team-b', '10.0.2.2', { 'bower/service': 'web', 'bower/canary': 'true', 'trellis/weight': '90' }),
  ])
  assert.match(config, /rolling\.example\.com \{[\s\S]*reverse_proxy 10\.0\.1\.1:32100/)
  assert.match(config, /canary\.example\.com \{[\s\S]*reverse_proxy (?:10\.0\.1\.[12]:32100 ?)+/)
  assert.doesNotMatch(config, /10\.0\.2\.[12]/)
})

test('renders the dashboard in normal, bootstrap, and empty-route configs', () => {
  const dashboard = { address: 'https://bower.example.com', upstream: '127.0.0.1:3000' }
  const expected = /https:\/\/bower\.example\.com \{\n  reverse_proxy 127\.0\.0\.1:3000\n\}/
  assert.match(renderCaddyfile([route], [allocation], { dashboard }), expected)
  assert.match(renderBootstrapCaddyfile([route], { dashboard }), expected)
  assert.match(renderCaddyfile([], [], { dashboard }), expected)
  assert.match(renderCaddyfile([], [], { dashboard: { upstream: '127.0.0.1:3000' } }), /:80 \{\n  reverse_proxy 127\.0\.0\.1:3000\n\}$/)
})

test('discovers dashboard allocations on any node without confusing another namespace', () => {
  const dashboard = { address: ':80', namespace: 'platform', job: 'bower', port: 3000 }
  const bower = { ...allocation, namespace: 'platform', job: 'bower', ports: [{ container_port: 3000, host_port: 3000 }] }
  const config = renderCaddyfile([], [
    bower,
    { ...bower, namespace: 'tenant', address: '10.0.0.99' },
    { ...bower, health: 'unhealthy', address: '10.0.0.98' },
  ], { dashboard })
  assert.match(config, /reverse_proxy 10\.0\.0\.2:3000/)
  assert.doesNotMatch(config, /10\.0\.0\.99|10\.0\.0\.98/)
  assert.match(renderBootstrapCaddyfile([], { dashboard }), /Bower dashboard is starting/)
})
