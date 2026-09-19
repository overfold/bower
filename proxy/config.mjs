const q = (value) => JSON.stringify(String(value))

const jobFor = (route, allocation) => route.strategy === 'canary'
  ? allocation.labels?.['bower/service'] === route.service
  : allocation.job === route.activeJob

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

export function renderCaddyfile(routes, allocations, { adminPort = '2019', httpPort = '80', httpsPort = '443' } = {}) {
  const rendered = routes.map((route) => {
    const upstreams = allocations.filter((allocation) => allocation.phase === 'running' && allocation.health === 'healthy' && jobFor(route, allocation)).flatMap((allocation) => {
      const port = allocation.ports?.find((item) => item.port === route.port)?.host_port || route.port
      const upstream = `${allocation.address}:${port}`
      const weight = Math.max(1, Number(allocation.labels?.['trellis/weight'] || 100))
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
