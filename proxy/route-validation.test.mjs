import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateRoute, parseRouteOptions } from './route-validation.mjs'
import { renderCaddyfile, renderBootstrapCaddyfile } from './config.mjs'

const route = { id: 'route-id', domain: 'app.example.test', pathPrefix: '/api', port: 8080, tlsMode: 'none', activeJob: 'web' }
const escape = '/safe* {\n    respond "INJECTED" 200\n  }\n}\nhttp://unverified.invalid {\n  handle /'

test('rejects syntax and placeholder injection in every route-controlled Caddy token, including bootstrap', () => {
  const patches = [
    ...[escape, '/a b', '/a\tb', '/a\rb', '/a"b', '/a\\b', '/{$ENV}', '@matcher', '/#comment'].map((pathPrefix) => ({ pathPrefix })),
    ...['X-Test\nrespond', 'X-Test {', 'X-Test"', '-Authorization', '+X-Test', '*', 'X-Test:'].flatMap((name) => [{ requestHeaders: { [name]: 'value' } }, { responseHeaders: { [name]: 'value' } }]),
    ...['x\r\ny', '{$ENV}', '{env.SECRET}', 'x\0y'].map((value) => ({ requestHeaders: { 'X-Test': value } })),
    ...[escape, '@all', '/{$ENV}'].map((from) => ({ redirects: [{ from, to: '/new', code: 308 }] })),
    ...['/new\nrespond', '/new"', '/{$ENV}', '/{env.SECRET}', 'javascript:alert(1)', 'https://x/ {'].map((to) => ({ redirects: [{ from: '/old', to, code: 308 }] })),
    ...[0, 200, 304, 309, NaN, '308\n}'].map((code) => ({ redirects: [{ from: '/old', to: '/new', code }] })),
    ...[-1, 0, 1.5, 1000001, Infinity, '1\n}'].map((rateLimit) => ({ rateLimit })),
    { domain: 'app.test\n{ respond 200 }' }, { port: '8080\n}' },
    { tlsCertSecret: '../cert' }, { tlsKeySecret: 'key\n}' },
    { authOrigin: 'https://bower.test\n}' }, { authOrigin: 'https://bower.test', id: 'id\n}' },
  ]
  for (const patch of patches) {
    const input = { ...route, ...patch }
    assert.throws(() => validateRoute(input), undefined, JSON.stringify(patch))
    assert.throws(() => renderCaddyfile([input], []))
    assert.throws(() => renderBootstrapCaddyfile([input]))
  }
})

test('form parser rejects malformed numbers and surplus redirect tokens instead of silently defaulting', () => {
  for (const [key, value] of [['pathPrefix', escape], ['port', 'garbage'], ['rateLimit', '-2'], ['rateLimit', '1.5'], ['rateLimit', '1000001'], ['redirects', '/old /new 308 ignored'], ['redirects', '/old /new html'], ['requestHeaders', 'X-Test {=bad']]) {
    const form = new FormData()
    form.set('domain', route.domain)
    form.set(key, value)
    assert.throws(() => parseRouteOptions(form), undefined, `${key}=${value}`)
  }
  const form = new FormData()
  form.set('domain', route.domain)
  form.set('rateLimit', '0')
  assert.equal(parseRouteOptions(form).rateLimit, null)
  for (const rateLimit of [1, 1000000]) validateRoute({ ...route, rateLimit })
})

test('real Caddy validates routes with auth, redirects, quoted headers and bounded rate limiting', { skip: !process.env.CADDY_BINARY }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'bower-config-security-'))
  try {
    const config = renderCaddyfile([{
      ...route, protectionMode: 'password', authOrigin: 'http://127.0.0.1:3000', rateLimit: 100,
      redirects: [{ from: '/api/old*', to: 'https://canonical.test{uri}', code: 308 }],
      requestHeaders: { 'X-Test': 'quotes " and \\ stay literal' }, responseHeaders: { 'X-Frame-Options': 'DENY' },
    }], [{ phase: 'running', health: 'healthy', job: 'web', endpoints: [{ task: 'web', address: '127.0.0.1' }] }], { httpPort: '18080', httpsPort: '18443' })
    const file = join(directory, 'Caddyfile')
    writeFileSync(file, config)
    const result = execFileSync(process.env.CADDY_BINARY, ['validate', '--config', file, '--adapter', 'caddyfile'], { encoding: 'utf8' })
    assert.match(result, /Valid configuration/)
    const adapted = JSON.parse(execFileSync(process.env.CADDY_BINARY, ['adapt', '--config', file, '--adapter', 'caddyfile'], { encoding: 'utf8' }))
    assert.deepEqual(adapted.apps.http.servers.srv0.routes[0].match[0].host, [route.domain])
    assert.doesNotMatch(JSON.stringify(adapted), /unverified.invalid|INJECTED/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
