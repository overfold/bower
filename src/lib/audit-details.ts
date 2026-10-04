const REDACTED = '[redacted]'
const sensitiveKey = /password|token|credential|authorization|cookie|privatekey|secretvalue/i
const valueMaps = new Set(['headers', 'requestHeaders', 'responseHeaders', 'envVars', 'labels'])

// Apply on writes and reads: historical full-row audit payloads must never
// reach client props, even when a diff would hide their unchanged fields.
export function redactAuditDetails(details: Record<string, unknown>): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object' || value instanceof Date) return value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (sensitiveKey.test(key) || ['healthCheckCommand', 'command', 'args', 'config', 'url'].includes(key)) return [key, REDACTED]
      if (valueMaps.has(key) && item && typeof item === 'object') return [key, Object.fromEntries(Object.keys(item).map((name) => [name, REDACTED]))]
      return [key, visit(item)]
    }))
  }
  return visit(details) as Record<string, unknown>
}

export function routeAuditState(route: Record<string, unknown>): Record<string, unknown> {
  const fields = ['domain', 'pathPrefix', 'port', 'tlsMode', 'serviceId', 'environmentId', 'protectionMode', 'rateLimit', 'tlsCertSecret', 'tlsKeySecret']
  return {
    ...Object.fromEntries(fields.filter((field) => field in route).map((field) => [field, route[field]])),
    requestHeaderNames: route.requestHeaderNames ?? Object.keys((route.headers ?? {}) as object),
    responseHeaderNames: route.responseHeaderNames ?? Object.keys((route.responseHeaders ?? {}) as object),
    redirectCount: route.redirectCount ?? (Array.isArray(route.redirects) ? route.redirects.length : 0),
  }
}

export function serviceConfigAuditState(config: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!config) return null
  const fields = ['image', 'replicas', 'cpu', 'memory', 'healthCheckType', 'healthCheckPort', 'healthCheckInterval', 'healthCheckTimeout', 'healthCheckThreshold', 'deploymentStrategy', 'resourceTier', 'autoRollbackSeconds', 'canarySteps', 'runtime', 'apiAccessScope', 'apiAccessLevel']
  return {
    ...Object.fromEntries(fields.filter((field) => field in config).map((field) => [field, config[field]])),
    environmentVariableNames: config.environmentVariableNames ?? Object.keys((config.envVars ?? {}) as object),
    labelNames: config.labelNames ?? Object.keys((config.labels ?? {}) as object),
  }
}
