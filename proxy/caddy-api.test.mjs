import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { loadCaddyConfig } from './caddy-api.mjs'

async function withServer(handler, run) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    await run(`http://127.0.0.1:${address.port}/load`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('loads Caddy config without browser fetch metadata headers', async () => {
  let requestHeaders
  let requestBody = ''
  await withServer((req, res) => {
    requestHeaders = req.headers
    req.setEncoding('utf8')
    req.on('data', (chunk) => { requestBody += chunk })
    req.on('end', () => {
      if (req.headers.origin || req.headers['sec-fetch-mode']) {
        res.writeHead(403, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: `client is not allowed to access from origin '${req.headers.origin || ''}'` }))
        return
      }
      res.writeHead(200)
      res.end()
    })
  }, async (url) => {
    await loadCaddyConfig(url, 'example.test { respond "ok" }')
  })

  assert.equal(requestHeaders.origin, undefined)
  assert.equal(requestHeaders['sec-fetch-mode'], undefined)
  assert.equal(requestHeaders['content-type'], 'text/caddyfile')
  assert.equal(requestBody, 'example.test { respond "ok" }')
})

test('surfaces Caddy admin errors', async () => {
  await withServer((_req, res) => {
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end('{"error":"denied"}')
  }, async (url) => {
    await assert.rejects(
      loadCaddyConfig(url, 'example.test {}'),
      /Caddy reload returned 403: {"error":"denied"}/,
    )
  })
})
