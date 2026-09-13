import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hostnameBelongsToDomain,
  hostnamesOverlap,
  normalizeManagedDomain,
  normalizeRouteHostname,
  routeHostnameForDomain,
} from './domains'

test('normalizes managed domains and route hostnames', () => {
  assert.equal(normalizeManagedDomain('Example.COM.'), 'example.com')
  assert.equal(normalizeRouteHostname('*.API.Example.com'), '*.api.example.com')
  assert.throws(() => normalizeManagedDomain('*.example.com'))
})

test('recognizes domains and delegated subtrees', () => {
  assert.equal(hostnameBelongsToDomain('api.example.com', 'example.com'), true)
  assert.equal(hostnameBelongsToDomain('example.com', 'example.com'), true)
  assert.equal(hostnameBelongsToDomain('api.example.com', 'internal.example.com'), false)
  assert.equal(hostnameBelongsToDomain('x.internal.example.com', 'internal.example.com'), true)
})

test('detects exact and wildcard hostname overlap', () => {
  assert.equal(hostnamesOverlap('api.example.com', 'api.example.com'), true)
  assert.equal(hostnamesOverlap('*.example.com', 'api.example.com'), true)
  assert.equal(hostnamesOverlap('*.example.com', 'example.com'), false)
  assert.equal(hostnamesOverlap('api.example.com', 'www.example.com'), false)
})

test('builds route hostnames from a managed domain', () => {
  assert.equal(routeHostnameForDomain('example.com', ''), 'example.com')
  assert.equal(routeHostnameForDomain('example.com', 'api'), 'api.example.com')
  assert.equal(routeHostnameForDomain('example.com', '*.preview'), '*.preview.example.com')
})
