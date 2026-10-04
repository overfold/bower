// Shared by server mutations and the ingress renderer. Stored routes are not
// trusted: older rows and alternate writers must obey the same grammar.
const path = /^\/[A-Za-z0-9/._~!$&'()+,;=:@%*-]*$/
const headerName = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const hostname = /^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i
const secretName = /^[A-Za-z0-9_-]+$/

function check(condition, message) {
  if (!condition) throw new Error(message)
}

export function validateRoute(route) {
  check(typeof route.domain === 'string' && route.domain.length <= 253 && hostname.test(route.domain), 'Invalid route domain.')
  check(typeof route.pathPrefix === 'string' && path.test(route.pathPrefix), 'Route paths must start with / and contain only URL path characters.')
  check(Number.isInteger(route.port) && route.port >= 1 && route.port <= 65535, 'Invalid route port.')
  check(['auto', 'custom', 'none'].includes(route.tlsMode), 'Invalid TLS mode.')
  check(route.rateLimit == null || (Number.isInteger(route.rateLimit) && route.rateLimit >= 1 && route.rateLimit <= 1000000), 'Rate limit must be an integer between 1 and 1000000.')
  for (const headers of [route.requestHeaders, route.responseHeaders]) {
    check(headers == null || (typeof headers === 'object' && !Array.isArray(headers)), 'Invalid headers.')
    for (const [name, value] of Object.entries(headers || {})) {
      check(headerName.test(name), 'Header names must contain only letters, numbers, hyphens, or underscores and start with a letter or number.')
      check(typeof value === 'string' && !/[\x00-\x1f\x7f{}]/.test(value), 'Header values cannot contain control characters or Caddy placeholders.')
    }
  }
  check(route.redirects == null || Array.isArray(route.redirects), 'Invalid redirects.')
  for (const rule of route.redirects || []) {
    check(typeof rule.from === 'string' && path.test(rule.from), 'Redirect source must be a URL path.')
    // {uri} is useful for canonical-host redirects; arbitrary Caddy placeholders
    // (especially environment substitutions) are not route configuration.
    check(typeof rule.to === 'string' && /^(?:\/|https?:\/\/)/.test(rule.to) && !/[\s\x00-\x1f\x7f"\\{}]/.test(rule.to.replaceAll('{uri}', '')), 'Redirect destination must be a URL or absolute path.')
    check([301, 302, 303, 307, 308].includes(rule.code), 'Redirect code must be 301, 302, 303, 307, or 308.')
  }
  for (const name of [route.tlsCertSecret, route.tlsKeySecret]) check(name == null || (typeof name === 'string' && secretName.test(name)), 'Invalid TLS secret name.')
  if (route.tlsMode === 'custom') check(route.tlsCertSecret && route.tlsKeySecret, 'Custom TLS requires certificate and key secrets.')
  check(route.protectionMode == null || ['none', 'password', 'bower_auth'].includes(route.protectionMode), 'Invalid route protection mode.')
  if (route.authOrigin) {
    const url = new URL(route.authOrigin)
    check(['http:', 'https:'].includes(url.protocol) && url.origin === route.authOrigin && !/[\s{}"\\]/.test(route.authOrigin), 'Invalid route auth origin.')
    check(typeof route.id === 'string' && /^[A-Za-z0-9_-]+$/.test(route.id), 'Invalid route auth ID.')
  }
}

export function parseRouteOptions(formData) {
  const text = (key) => String(formData.get(key) ?? '').trim()
  const headers = (key) => Object.fromEntries(text(key).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.indexOf('=')
    check(at > 0, 'Headers must use name=value lines.')
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
  }))
  const route = {
    domain: text('domain').toLowerCase().replace(/\.$/, ''), pathPrefix: text('pathPrefix') || '/',
    port: text('port') ? Number(text('port')) : 8080, tlsMode: text('tlsMode') || 'auto',
    requestHeaders: headers('requestHeaders'), responseHeaders: headers('responseHeaders'),
    rateLimit: text('rateLimit') && text('rateLimit') !== '0' ? Number(text('rateLimit')) : null,
    redirects: text('redirects').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/\s+/)
      check(parts.length === 2 || parts.length === 3, 'Redirects must use source destination [code] lines.')
      return { from: parts[0], to: parts[1], code: parts.length === 3 ? Number(parts[2]) : 308 }
    }),
    tlsCertSecret: text('tlsCertSecret') || null, tlsKeySecret: text('tlsKeySecret') || null,
  }
  validateRoute(route)
  const { requestHeaders, ...values } = route
  return { ...values, headers: requestHeaders }
}
