import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { environments, managedProxies, projects, routes, services, serviceConfigs } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import type { TrellisJobSpec } from '@/types/trellis'

function proxyPort(name: 'BOWER_PROXY_HTTP_PORT' | 'BOWER_PROXY_HTTPS_PORT', fallback: number) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid TCP port.`)
  return value
}

export async function syncManagedProxy(projectId: string, environmentId: string, orgId: string) {
  const [environment] = await db.select().from(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!environment || !project) throw new Error('Proxy environment was not found.')

  const definitions = await db.select({ route: routes, service: services, config: serviceConfigs })
    .from(routes)
    .innerJoin(services, eq(services.id, routes.serviceId))
    .innerJoin(serviceConfigs, and(eq(serviceConfigs.serviceId, services.id), eq(serviceConfigs.environmentId, environmentId)))
    .where(and(eq(routes.projectId, projectId), eq(routes.environmentId, environmentId)))
  const client = await getTrellisClient(orgId)
  if (definitions.length === 0) {
    await client.deleteJob('bower-proxy', environment.trellisNamespace).catch(() => undefined)
    await client.deleteSecret(environment.trellisNamespace, 'BOWER_CADDYFILE').catch(() => undefined)
    await db.delete(managedProxies).where(eq(managedProxies.environmentId, environmentId))
    return
  }
  const controllerRoutes: Array<Record<string, unknown>> = []
  const bowerPublicUrl = process.env.BOWER_PUBLIC_URL
  const authOrigin = bowerPublicUrl ? new URL(bowerPublicUrl).origin : null

  for (const definition of definitions) {
    const requestHeaders = definition.route.headers as Record<string, string>
    const responseHeaders = definition.route.responseHeaders as Record<string, string>
    const redirects = definition.route.redirects as Array<{ from: string; to: string; code?: number }>
    if (definition.route.protectionMode === 'bower_auth' && !authOrigin) {
      throw new Error('BOWER_PUBLIC_URL is required for Bower authentication.')
    }
    controllerRoutes.push({ id: definition.route.id, projectId, domain: definition.route.domain, pathPrefix: definition.route.pathPrefix, port: definition.route.port, tlsMode: definition.route.tlsMode, tlsCertSecret: definition.route.tlsCertSecret, tlsKeySecret: definition.route.tlsKeySecret, requestHeaders, responseHeaders, redirects, rateLimit: definition.route.rateLimit, protectionMode: definition.route.protectionMode, passwordHash: definition.route.passwordHash, authOrigin, service: definition.service.slug, activeJob: definition.config.activeJobName || definition.service.slug, strategy: definition.config.deploymentStrategy })
  }

  const httpPort = proxyPort('BOWER_PROXY_HTTP_PORT', 80)
  const httpsPort = proxyPort('BOWER_PROXY_HTTPS_PORT', 443)
  const adminPort = 20_000 + (parseInt(createHash('sha256').update(environment.id).digest('hex').slice(0, 4), 16) % 10_000)
  const caddyfile = `{\n  admin 0.0.0.0:${adminPort}\n  http_port ${httpPort}\n  https_port ${httpsPort}\n  order rate_limit before basic_auth\n}\n\n:${httpPort} { respond "Bower proxy is discovering routes" 200 }`
  const hash = createHash('sha256').update(JSON.stringify(controllerRoutes)).digest('hex')
  const secretName = 'BOWER_CADDYFILE'
  await client.setSecret(environment.trellisNamespace, secretName, caddyfile)

  const customTls = definitions.flatMap(({ route }) => route.tlsMode === 'custom' && route.tlsCertSecret && route.tlsKeySecret
    ? [{ name: route.tlsCertSecret, target: 'file' as const, path: `/run/trellis-secrets/${route.tlsCertSecret}` }, { name: route.tlsKeySecret, target: 'file' as const, path: `/run/trellis-secrets/${route.tlsKeySecret}` }]
    : [])
  const spec: TrellisJobSpec = {
    name: 'bower-proxy',
    namespace: environment.trellisNamespace,
    task_groups: [{
      name: 'proxy', count: 1, api_access: { scope: 'namespace', access: 'read' },
      labels: { 'bower/managed': 'true', 'bower/infrastructure': 'proxy' },
      update: { strategy: 'rolling', max_parallel: 1 },
      tasks: [{
        name: 'caddy', image: process.env.BOWER_CADDY_IMAGE || 'ghcr.io/clofour/bower-caddy:latest',
        resources: { cpu: 100, memory: 134217728 },
        networking: { mode: 'host', ports: [{ port: httpPort }, { port: httpsPort }, { port: adminPort }] },
        secrets: [{ name: secretName, target: 'file', path: '/run/trellis-secrets/BOWER_CADDYFILE' }, ...customTls],
        health_check: { type: 'tcp', port: httpPort, interval: 10_000_000_000, timeout: 2_000_000_000, threshold: 3 },
      }, {
        name: 'route-sync', image: process.env.BOWER_PROXY_SYNC_IMAGE || 'ghcr.io/clofour/bower-proxy-sync:latest',
        resources: { cpu: 50, memory: 67108864 }, networking: { mode: 'host' },
        env: { BOWER_ROUTES: JSON.stringify(controllerRoutes), CADDY_ADMIN_URL: `http://127.0.0.1:${adminPort}/load`, CADDY_ADMIN_PORT: String(adminPort), CADDY_HTTP_PORT: String(httpPort), CADDY_HTTPS_PORT: String(httpsPort), BOWER_SYNC_INTERVAL: '5' },
      }],
    }],
  }

  await db.insert(managedProxies).values({ environmentId, trellisJobName: spec.name, status: 'pending', port: httpPort, configHash: hash })
    .onConflictDoUpdate({ target: managedProxies.environmentId, set: { status: 'pending', port: httpPort, configHash: hash, updatedAt: new Date() } })
  try {
    await client.applyJob(spec, environment.trellisNamespace)
    await db.update(managedProxies).set({ status: 'running', updatedAt: new Date() }).where(eq(managedProxies.environmentId, environmentId))
  } catch (error) {
    await db.update(managedProxies).set({ status: 'error', updatedAt: new Date() }).where(eq(managedProxies.environmentId, environmentId))
    throw error
  }
}
