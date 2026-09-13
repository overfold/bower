const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

function normalizeBaseHostname(input: string) {
  const hostname = input.trim().toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname.length > 253 || IPV4.test(hostname)) {
    throw new Error('Enter a valid DNS domain name.')
  }

  const labels = hostname.split('.')
  if (labels.some((label) => !DOMAIN_LABEL.test(label))) {
    throw new Error('Enter a valid DNS domain name.')
  }

  return hostname
}

export function normalizeManagedDomain(input: string) {
  if (input.trim().startsWith('*.')) {
    throw new Error('Add the parent domain instead of a wildcard domain.')
  }
  return normalizeBaseHostname(input)
}

export function normalizeRouteHostname(input: string) {
  const value = input.trim().toLowerCase().replace(/\.$/, '')
  if (value.startsWith('*.')) return `*.${normalizeBaseHostname(value.slice(2))}`
  return normalizeBaseHostname(value)
}

export function hostnameBelongsToDomain(hostname: string, domain: string) {
  const normalizedHostname = normalizeRouteHostname(hostname)
  const normalizedDomain = normalizeManagedDomain(domain)
  const concreteHostname = normalizedHostname.startsWith('*.')
    ? normalizedHostname.slice(2)
    : normalizedHostname
  return concreteHostname === normalizedDomain || concreteHostname.endsWith(`.${normalizedDomain}`)
}

function wildcardBase(hostname: string) {
  return hostname.startsWith('*.') ? hostname.slice(2) : null
}

export function hostnamesOverlap(left: string, right: string) {
  const a = normalizeRouteHostname(left)
  const b = normalizeRouteHostname(right)
  if (a === b) return true

  const aWildcard = wildcardBase(a)
  const bWildcard = wildcardBase(b)
  if (aWildcard && bWildcard) {
    return aWildcard === bWildcard || aWildcard.endsWith(`.${bWildcard}`) || bWildcard.endsWith(`.${aWildcard}`)
  }
  if (aWildcard) return b.endsWith(`.${aWildcard}`)
  if (bWildcard) return a.endsWith(`.${bWildcard}`)
  return false
}

export function routeHostnameForDomain(domain: string, prefix: string) {
  const normalizedDomain = normalizeManagedDomain(domain)
  const trimmedPrefix = prefix.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  return normalizeRouteHostname(trimmedPrefix ? `${trimmedPrefix}.${normalizedDomain}` : normalizedDomain)
}
