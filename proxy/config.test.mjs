import assert from 'node:assert/strict'
import test from 'node:test'
import { renderCaddyfile } from './config.mjs'

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
