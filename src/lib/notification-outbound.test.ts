import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { lookup } from 'node:dns/promises'
import { isPublicNotificationAddress, postNotification } from './notification-outbound'

test('notification policy blocks special IPv4, IPv6, mapped and transition ranges', () => {
  for (const address of ['0.0.0.0', '10.0.0.1', '127.0.0.2', '169.254.169.254', '172.16.2.4', '192.168.4.5', '100.64.2.3', '192.0.0.9', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.2', '224.0.0.1', '240.0.0.1', '::', '::1', 'fc00::1', 'fe80::1', 'fec0::1', 'ff02::1', '::ffff:127.0.0.1', '64:ff9b::a00:1', '2002:a00:1::', '2001:db8::1', '3fff::1', '4000::1']) {
    assert.equal(isPublicNotificationAddress(address), false, address)
  }
  assert.equal(isPublicNotificationAddress('8.8.4.4'), true)
  assert.equal(isPublicNotificationAddress('2606:4700:4700::1111'), true)
})

test('actual HTTPS dispatch pins one lookup, denies rebound/mixed/private DNS and never follows redirects', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bower-outbound-'))
  const keyPath = join(directory, 'key.pem'); const certPath = join(directory, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=notify.test', '-addext', 'subjectAltName=DNS:notify.test'], { stdio: 'ignore' })
  const cert = readFileSync(certPath)
  const received: string[] = []
  const server = createServer({ key: readFileSync(keyPath), cert }, async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk
    received.push(`${req.url}:${raw}`)
    res.writeHead(req.url === '/redirect' ? 302 : 204, { location: '/secret' }).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address(); assert.ok(address && typeof address !== 'string')
  const base = `https://notify.test:${address.port}`
  const oldPolicy = process.env.BOWER_NOTIFICATION_PRIVATE_URLS
  let lookups = 0
  const resolver = (async () => { lookups++; return [{ address: '127.0.0.1', family: 4 }] }) as unknown as typeof lookup
  try {
    delete process.env.BOWER_NOTIFICATION_PRIVATE_URLS
    await assert.rejects(postNotification(`${base}/hook`, { denied: true }, { resolve: resolver, ca: cert }), /forbidden/)
    assert.equal(received.length, 0)
    // Operator enables exactly two test endpoints, not their origin.
    process.env.BOWER_NOTIFICATION_PRIVATE_URLS = JSON.stringify([`${base}/hook`, `${base}/redirect`])
    lookups = 0
    assert.equal(await postNotification(`${base}/hook`, { asymmetric: 'λ', count: 7 }, { resolve: resolver, ca: cert }), 204)
    assert.equal(lookups, 1)
    assert.equal(received[0], '/hook:{"asymmetric":"λ","count":7}')
    assert.equal(await postNotification(`${base}/redirect`, {}, { resolve: resolver, ca: cert }), 302)
    assert.equal(received.length, 2)
    await assert.rejects(postNotification(`${base}/secret`, {}, { resolve: resolver, ca: cert }), /forbidden/)
    delete process.env.BOWER_NOTIFICATION_PRIVATE_URLS
    // First DNS call contains a public address followed by private IPv6. No
    // candidate may connect; a second lookup (rebind) must never occur.
    let calls = 0
    const mixed = (async () => { calls++; return calls === 1 ? [{ address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 }] : [{ address: '127.0.0.1', family: 4 }] }) as unknown as typeof lookup
    await assert.rejects(postNotification(`${base}/hook`, {}, { resolve: mixed }), /forbidden/)
    assert.equal(calls, 1)
    await assert.rejects(postNotification(`https://127.0.0.1:${address.port}/hook`, {}), /not a public/)
    await assert.rejects(postNotification(`https://[::ffff:127.0.0.1]:${address.port}/hook`, {}), /not a public/)
    assert.equal(received.length, 2)
    process.env.BOWER_NOTIFICATION_PRIVATE_URLS = JSON.stringify([`${base}/hook`])
    await assert.rejects(postNotification(`${base}/hook`, {}, { resolve: resolver }), /self-signed certificate/)
  } finally {
    if (oldPolicy === undefined) delete process.env.BOWER_NOTIFICATION_PRIVATE_URLS
    else process.env.BOWER_NOTIFICATION_PRIVATE_URLS = oldPolicy
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(directory, { recursive: true, force: true })
  }
})
