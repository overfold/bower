import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'

test('auth pages stay reachable with stale cookies, including invitation return paths', () => {
  for (const path of ['/login', '/register', '/login?next=%2Finvite%2Fexample']) {
    const response = proxy(new NextRequest(`https://bower.example${path}`, {
      headers: { cookie: 'bower_session=previous-installation-session' },
    }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('location'), null)
  }
})

test('protected pages still require a session cookie and leave validation to the server', () => {
  for (const path of ['/projects', '/no-organization']) {
    const url = `https://bower.example${path}`
    const unauthenticated = proxy(new NextRequest(url))
    assert.equal(unauthenticated.status, 307)
    assert.equal(unauthenticated.headers.get('location'), 'https://bower.example/login')
    const withCookie = proxy(new NextRequest(url, {
      headers: { cookie: 'bower_session=session-to-validate' },
    }))
    assert.equal(withCookie.status, 200)
    assert.equal(withCookie.headers.get('location'), null)
  }
})
