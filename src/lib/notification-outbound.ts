import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import type { ConnectionOptions } from 'node:tls'
import ipaddr from 'ipaddr.js'

export function isPublicNotificationAddress(value: string): boolean {
  if (!isIP(value)) return false
  const address = ipaddr.process(value)
  if (address.range() !== 'unicast') return false
  // IPv6 is default-deny outside currently allocated global unicast space.
  return address.kind() === 'ipv4' || address.match(ipaddr.parseCIDR('2000::/3'))
}

function privateEndpointAllowed(url: URL): boolean {
  // Only the operator can grant an exception, for an exact endpoint (not a
  // hostname wildcard, tenant-supplied flag, or redirect destination).
  const configured: unknown = JSON.parse(process.env.BOWER_NOTIFICATION_PRIVATE_URLS || '[]')
  return Array.isArray(configured) && configured.some((value) => typeof value === 'string' && new URL(value).href === url.href)
}

export function validateNotificationUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('A credential-free HTTPS endpoint is required.')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname) && !isPublicNotificationAddress(hostname) && !privateEndpointAllowed(url)) throw new Error('Notification endpoint is not a public destination.')
  return url
}

// A fresh socket per delivery: DNS is checked in the connection lookup and the
// approved address is returned directly to net.connect, with no second lookup.
// Node HTTPS retains the original hostname for SNI and certificate verification.
export async function postNotification(value: string, body: unknown, options: {
  resolve?: typeof lookup
  ca?: ConnectionOptions['ca']
} = {}): Promise<number> {
  const url = validateNotificationUrl(value)
  const allowPrivate = privateEndpointAllowed(url)
  const resolve = options.resolve || lookup
  const signal = AbortSignal.timeout(10_000)
  return new Promise((accept, reject) => {
    const req = request(url, {
      method: 'POST', agent: false, signal, ca: options.ca,
      headers: { 'content-type': 'application/json' },
      lookup(hostname, _options, callback) {
        void resolve(hostname, { all: true, verbatim: true }).then((addresses) => {
          if (!addresses.length || addresses.some(({ address }) => !isIP(address) || (!allowPrivate && !isPublicNotificationAddress(address)))) {
            callback(new Error('Notification endpoint resolved to a forbidden destination.'), [])
            return
          }
          // Modern Node requests all candidates for family autoselection.
          if (_options.all) callback(null, addresses)
          else callback(null, addresses[0].address, addresses[0].family)
        }, (error: Error) => callback(error, []))
      },
    }, (response) => {
      const status = response.statusCode || 502
      // No redirect following, and no response disclosure or unbounded read.
      response.destroy()
      accept(status)
    })
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}
