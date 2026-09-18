import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test'
process.env.BOWER_ROUTE_AUTH_SECRET = 'test-secret-that-is-at-least-32-characters'

const routeAuth = import('./route-auth')

test('route grants are signed, typed, and expire', async () => {
  const { signRouteAuthToken, verifyRouteAuthToken } = await routeAuth
  const token = signRouteAuthToken({ type: 'grant', routeId: 'route-1', protectionMode: 'bower_auth', userId: 'user-1' }, 60)
  assert.equal(verifyRouteAuthToken(token, 'grant')?.routeId, 'route-1')
  assert.equal(verifyRouteAuthToken(token, 'handoff'), null)
  const tampered = `${token[0] === 'x' ? 'y' : 'x'}${token.slice(1)}`
  assert.equal(verifyRouteAuthToken(tampered, 'grant'), null)

  const expired = signRouteAuthToken({ type: 'grant', routeId: 'route-1', protectionMode: 'bower_auth', userId: 'user-1' }, -1)
  assert.equal(verifyRouteAuthToken(expired, 'grant'), null)
})

test('password route grants are route scoped without requiring a Bower account', async () => {
  const { createPasswordRouteGrant, createPasswordRouteHandoff, passwordRouteGrantMatches, verifyRouteAuthToken } = await routeAuth
  const token = createPasswordRouteGrant('route-1', '$2b$12$password-hash')
  const grant = verifyRouteAuthToken(token, 'grant')
  assert.equal(grant?.protectionMode, 'password')
  assert.equal(grant?.userId, undefined)
  assert.equal(grant && passwordRouteGrantMatches(grant, '$2b$12$password-hash'), true)
  assert.equal(grant && passwordRouteGrantMatches(grant, '$2b$12$new-password-hash'), false)

  const handoff = verifyRouteAuthToken(createPasswordRouteHandoff('route-1', 'https://preview.example.com/'), 'handoff')
  assert.equal(handoff?.protectionMode, 'password')
})

test('return URLs must belong to the exact route hostname and path', async () => {
  const { routeMatchesUrl } = await routeAuth
  const route = { domain: 'preview.example.com', pathPrefix: '/app' }
  assert.equal(routeMatchesUrl(route, new URL('https://preview.example.com/app/dashboard')), true)
  assert.equal(routeMatchesUrl(route, new URL('https://preview.example.com/other')), false)
  assert.equal(routeMatchesUrl(route, new URL('https://preview.example.com.evil.test/app')), false)
})

test('wildcard route URLs require a subdomain', async () => {
  const { routeMatchesUrl } = await routeAuth
  const route = { domain: '*.preview.example.com', pathPrefix: '/' }
  assert.equal(routeMatchesUrl(route, new URL('https://branch.preview.example.com/')), true)
  assert.equal(routeMatchesUrl(route, new URL('https://preview.example.com/')), false)
})
