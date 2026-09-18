import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test'
process.env.BOWER_ROUTE_AUTH_SECRET = 'test-secret-that-is-at-least-32-characters'

const routeAuth = import('./route-auth')

test('route grants are signed, typed, and expire', async () => {
  const { signRouteAuthToken, verifyRouteAuthToken } = await routeAuth
  const token = signRouteAuthToken({ type: 'grant', routeId: 'route-1', userId: 'user-1' }, 60)
  assert.equal(verifyRouteAuthToken(token, 'grant')?.routeId, 'route-1')
  assert.equal(verifyRouteAuthToken(token, 'handoff'), null)
  assert.equal(verifyRouteAuthToken(`${token.slice(0, -1)}x`, 'grant'), null)

  const expired = signRouteAuthToken({ type: 'grant', routeId: 'route-1', userId: 'user-1' }, -1)
  assert.equal(verifyRouteAuthToken(expired, 'grant'), null)
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
