const q = (value) => JSON.stringify(String(value))

const namespaceFor = (route, allocation) => !route.namespace || route.namespace === allocation.namespace

const jobFor = (route, allocation) => namespaceFor(route, allocation) && (route.strategy === 'canary'
  ? allocation.labels?.['bower/service'] === route.service
  : allocation.job === route.activeJob)

// Bower creates one routable task per service job and names it after the job.
// Do not guess among endpoints from arbitrary multi-task workloads.
function allocationUpstream(allocation, containerPort) {
  const endpoints = Array.isArray(allocation.endpoints) ? allocation.endpoints : []
  const endpoint = endpoints.find((item) => item.task === allocation.job)
  if (endpoints.length > 0) {
    if (!endpoint) return null
    const mapping = endpoint.ports?.find((item) => item.container_port === containerPort)
    // Namespace endpoints are private task addresses. Published host ports
    // apply to node addresses, not to these directly reachable endpoints.
    return endpoint.address && mapping ? `${endpoint.address}:${mapping.container_port}` : null
  }

  // Compatibility for allocations written before task endpoints were added.
  const mapping = allocation.ports?.find((item) => item.container_port === containerPort)
  return allocation.address && mapping ? `${allocation.address}:${mapping.host_port}` : null
}

function authLines(route) {
  if ((route.protectionMode === 'password' || route.protectionMode === 'bower_auth') && route.authOrigin) {
    return [
      `    forward_auth ${route.authOrigin} {`,
      `      uri /api/route-auth/verify/${route.id}`,
      '      header_up Host {upstream_hostport}',
      '      header_up X-Bower-Forwarded-Host {http.request.host}',
      '      header_up X-Bower-Forwarded-Uri {uri}',
      '      header_up X-Bower-Forwarded-Proto {scheme}',
      '    }',
    ]
  }
  return []
}

export function renderCaddyfile(routes, allocations, { adminPort = '2019', httpPort = '80', httpsPort = '443', dashboard } = {}) {
  const rendered = routes.map((route) => {
    const candidates = route.strategy === 'canary'
      ? allocations.filter((allocation) => namespaceFor(route, allocation) && allocation.labels?.['bower/service'] === route.service && allocation.labels?.['bower/canary'] === 'true')
      : []
    const canaryWeight = candidates.reduce((weight, allocation) => Math.max(weight, Number(allocation.labels?.['trellis/weight'] || 0)), 0)
    const upstreams = allocations.filter((allocation) => allocation.phase === 'running' && allocation.health === 'healthy' && jobFor(route, allocation)).flatMap((allocation) => {
      const upstream = allocationUpstream(allocation, route.port)
      if (!upstream) return []
      const weight = allocation.labels?.['bower/canary'] === 'true'
        ? Number(allocation.labels?.['trellis/weight'] || 0)
        : route.strategy === 'canary' && canaryWeight > 0
          ? 100 - canaryWeight
          : 100
      if (!Number.isFinite(weight) || weight <= 0) return []
      return Array.from({ length: Math.min(100, weight) }, () => upstream)
    })
    const lines = []
    for (const rule of route.redirects || []) lines.push(`    redir ${rule.from} ${rule.to} ${rule.code || 308}`)
    lines.push(...authLines(route))
    if (!upstreams.length) lines.push('    respond "No healthy upstream allocations" 503')
    else {
      lines.push(`    reverse_proxy ${upstreams.join(' ')} {`)
      for (const [name, value] of Object.entries(route.requestHeaders || {})) lines.push(`      header_up ${name} ${q(value)}`)
      for (const [name, value] of Object.entries(route.responseHeaders || {})) lines.push(`      header_down ${name} ${q(value)}`)
      lines.push('    }')
    }
    if (route.rateLimit) lines.unshift(`    rate_limit { zone route_${Buffer.from(`${route.domain}${route.pathPrefix}`).toString('hex').slice(0, 20)} { key {remote_host} events ${route.rateLimit} window 1s } }`)
    return { ...route, lines }
  })
  const groups = new Map()
  for (const route of rendered) {
    const key = `${route.tlsMode === 'none' ? 'http://' : ''}${route.domain}`
    if (!groups.has(key)) groups.set(key, { route, handlers: [] })
    groups.get(key).handlers.push(route)
  }
  const blocks = [...groups.entries()].map(([address, group]) => {
    const lines = [`${address} {`]
    if (group.route.tlsMode === 'custom' && group.route.tlsCertSecret && group.route.tlsKeySecret) lines.push(`  tls /run/trellis-secrets/${group.route.tlsCertSecret} /run/trellis-secrets/${group.route.tlsKeySecret}`)
    const authRoute = group.handlers.find((route) => route.protectionMode !== 'none' && route.authOrigin)
    if (authRoute) {
      lines.push(
        '  handle /.bower/auth/callback {',
        `    reverse_proxy ${authRoute.authOrigin} {`,
        '      rewrite /api/route-auth/callback',
        '      header_up Host {upstream_hostport}',
        '    }',
        '  }',
      )
    }
    for (const route of group.handlers.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)) {
      lines.push(route.pathPrefix === '/' ? '  handle {' : `  handle ${route.pathPrefix}* {`, ...route.lines, '  }')
    }
    lines.push('}'); return lines.join('\n')
  })
  if (dashboard) {
    const upstreams = dashboard.upstream ? [dashboard.upstream] : allocations
      .filter((item) => item.namespace === dashboard.namespace && item.job === dashboard.job && item.phase === 'running' && item.health === 'healthy')
      .map((item) => allocationUpstream(item, dashboard.port)).filter(Boolean)
    blocks.push(`${dashboard.address || ':80'} {\n  ${upstreams.length ? `reverse_proxy ${upstreams.join(' ')}` : 'respond "Bower dashboard is starting" 503'}\n}`)
  }
  return `{\n  admin 127.0.0.1:${adminPort}\n  http_port ${httpPort}\n  https_port ${httpsPort}\n}\n\n${blocks.length ? blocks.join('\n\n') : `:${httpPort} {\n  respond "Bower proxy ready" 200\n}`}`
}


export function renderBootstrapCaddyfile(routes, options = {}) {
  const bootstrapRoutes = routes.map((route) => ({
    ...route,
    protectionMode: 'none',
    authOrigin: null,
    redirects: [],
    rateLimit: null,
  }))
  return renderCaddyfile(bootstrapRoutes, [], options)
}
