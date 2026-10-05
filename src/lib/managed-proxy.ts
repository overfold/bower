import { createHash } from 'node:crypto'
import { renderBootstrapCaddyfile } from '../../proxy/config.mjs'
import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/db'
import { environments, managedProxies, organizations, projects, routes, services, serviceConfigs } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { hasTrellisConnection } from '@/lib/trellis-connection'
import { getIngressCluster, ingressNamespace, ingressSecretName } from '@/lib/ingress-cluster'
import { hostnamesOverlap } from '@/lib/domains'
import { TrellisApiError } from '@/lib/trellis'
import type { TrellisJobSpec, TrellisVolume } from '@/types/trellis'
import { trellisReadError } from '@/lib/trellis-runtime'

function proxyPort(name: 'BOWER_PROXY_HTTP_PORT' | 'BOWER_PROXY_HTTPS_PORT', fallback: number) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid TCP port.`)
  return value
}

// Serialize same-process writers. Trellis plan/apply fences competing replicas;
// periodic reconciliation retries a rejected plan with current desired state.
let synchronization: Promise<unknown> = Promise.resolve()

export async function syncManagedProxy(_projectId: string, _environmentId: string, orgId: string, removedServiceId?: string, removedProjectId?: string) {
  const next = synchronization.catch(() => {}).then(() => syncClusterIngress(orgId, removedServiceId, removedProjectId))
  synchronization = next
  return next
}

async function syncClusterIngress(orgId: string, removedServiceId?: string, removedProjectId?: string) {
  const cluster = await getIngressCluster(orgId)
  const namespace = ingressNamespace()
  const definitions = await db.select({ route: routes, service: services, config: serviceConfigs, environment: environments })
    .from(routes)
    .innerJoin(services, eq(services.id, routes.serviceId))
    .innerJoin(serviceConfigs, and(eq(serviceConfigs.serviceId, services.id), eq(serviceConfigs.environmentId, routes.environmentId)))
    .innerJoin(environments, eq(environments.id, routes.environmentId))
    .innerJoin(projects, eq(projects.id, routes.projectId))
    .where(and(inArray(projects.orgId, cluster.orgIds), removedServiceId ? ne(routes.serviceId, removedServiceId) : undefined,
      removedProjectId ? ne(routes.projectId, removedProjectId) : undefined)).orderBy(asc(routes.id))
  const client = await getTrellisClient(orgId)
  const httpPort = proxyPort('BOWER_PROXY_HTTP_PORT', 80)
  const httpsPort = proxyPort('BOWER_PROXY_HTTPS_PORT', 443)
  const adminPort = 2019
  const publicUrl = process.env.BOWER_PUBLIC_URL ? new URL(process.env.BOWER_PUBLIC_URL) : null
  const dashboard = cluster.home ? {
    address: publicUrl?.origin || `:${httpPort}`,
    upstream: process.env.BOWER_PROXY_DASHBOARD_UPSTREAM || undefined,
    namespace: process.env.TRELLIS_NAMESPACE || 'platform', job: 'bower', port: 3000,
  } : undefined
  const controllerRoutes: Array<Record<string, unknown>> = []
  const customTls = new Map<string, number>()
  for (const { route, service, config, environment } of definitions) {
    if (dashboard && publicUrl && hostnamesOverlap(route.domain, publicUrl.hostname)) {
      throw new Error(`${route.domain} overlaps the reserved Bower dashboard hostname.`)
    }
    const conflict = definitions.find((item) => item.route.id !== route.id &&
      hostnamesOverlap(item.route.domain, route.domain) &&
      (item.route.projectId !== route.projectId || item.route.environmentId !== route.environmentId))
    if (conflict) throw new Error(`${route.domain} overlaps another environment's hostname on this cluster.`)
    if (route.protectionMode !== 'none' && !publicUrl) throw new Error('BOWER_PUBLIC_URL is required for protected routes.')
    const tlsNames: Record<string, string | null> = { tlsCertSecret: null, tlsKeySecret: null }
    if (route.tlsMode === 'custom') {
      for (const field of ['tlsCertSecret', 'tlsKeySecret'] as const) {
        if (!route[field]) throw new Error('Custom TLS requires certificate and key secrets.')
        const name = ingressSecretName(environment.trellisNamespace, route[field])
        if (!customTls.has(name)) {
          try { customTls.set(name, (await client.getSecret(namespace, name)).version) }
          catch (error) {
            if (error instanceof TrellisApiError && error.status === 404) throw new Error(`Re-upload TLS secret ${route[field]} in its environment to make it available to shared ingress.`)
            throw error
          }
        }
        tlsNames[field] = name
      }
    }
    controllerRoutes.push({ id: route.id, projectId: route.projectId, namespace: environment.trellisNamespace,
      domain: route.domain, pathPrefix: route.pathPrefix, port: route.port, tlsMode: route.tlsMode, ...tlsNames,
      requestHeaders: route.headers, responseHeaders: route.responseHeaders, redirects: route.redirects,
      rateLimit: route.rateLimit, protectionMode: route.protectionMode, authOrigin: publicUrl?.origin || null,
      service: service.slug, activeJob: config.activeJobName || service.slug, strategy: config.deploymentStrategy })
  }
  const options = { adminPort: String(adminPort), httpPort: String(httpPort), httpsPort: String(httpsPort), dashboard }
  // Stable namespace-scoped storage survives route-driven allocation recreation.
  const volumes: TrellisVolume[] = [
    { name: 'bower-ingress-data', host_path: '@/bower-ingress-data', container_path: '/data' },
    { name: 'bower-ingress-config', host_path: '@/bower-ingress-config', container_path: '/config' },
  ]
  const hash = createHash('sha256').update(JSON.stringify({ controllerRoutes, options, tls: [...customTls], volumes })).digest('hex')
  const spec: TrellisJobSpec = {
    name: 'bower-ingress', namespace,
    task_groups: [{ name: 'proxy', count: 1, api_access: { scope: 'cluster', access: 'read' },
      labels: { 'bower/managed': 'true', 'bower/infrastructure': 'proxy', 'bower/config-hash': hash },
      update: { strategy: 'recreate' },
      tasks: [{ name: 'caddy', image: process.env.BOWER_CADDY_IMAGE || 'ghcr.io/overfold/bower-proxy:latest',
        resources: { cpu: 100, memory: 134217728 },
        networking: { mode: 'host', ports: [{ port: httpPort }, { port: httpsPort }, { port: adminPort }] },
        volumes,
        // Keep bootstrap config in the fenced job revision, not a separately
        // mutable secret that another replica could overwrite before apply.
        env: { BOWER_CADDYFILE: renderBootstrapCaddyfile(controllerRoutes, options) },
        secrets: [...customTls.keys()].map((name) => ({ name, target: 'file' as const, path: `/run/trellis-secrets/${name}` })),
        health_check: { type: 'tcp', port: httpPort, interval: 10_000_000_000, timeout: 2_000_000_000, threshold: 3 },
      }, { name: 'route-sync', image: process.env.BOWER_PROXY_SYNC_IMAGE || 'ghcr.io/overfold/bower-proxy-sync:latest',
        resources: { cpu: 50, memory: 67108864 }, networking: { mode: 'host' },
        env: { BOWER_ROUTES: JSON.stringify(controllerRoutes), BOWER_DASHBOARD: dashboard ? JSON.stringify(dashboard) : '',
          CADDY_ADMIN_URL: `http://127.0.0.1:${adminPort}/load`, CADDY_ADMIN_PORT: String(adminPort),
          CADDY_HTTP_PORT: String(httpPort), CADDY_HTTPS_PORT: String(httpsPort), BOWER_SYNC_INTERVAL: '5', BOWER_SYNC_HEALTH_MAX_AGE: '15' },
        health_check: { type: 'script', command: ['/usr/local/bin/node', '/app/healthcheck.mjs'], interval: 5_000_000_000, timeout: 2_000_000_000, threshold: 2 },
      }],
    }],
  }
  let current
  try { current = await client.getJob(spec.name, namespace) }
  catch (error) { if (!(error instanceof TrellisApiError && error.status === 404)) throw error }
  // No-op periodic reconciliation must not restart ingress. Include images
  // and TLS versions in the desired hash/spec.
  if (current?.spec?.task_groups[0]?.labels?.['bower/config-hash'] !== hash ||
    current.spec.task_groups[0].tasks.some((task, index) => task.image !== spec.task_groups[0].tasks[index]?.image)) {
    const plan = await client.planJob(spec, namespace)
    await client.applyJobPlan(spec, namespace, plan)
  }
  const clusterEnvironments = await db.select({ id: environments.id }).from(environments)
    .innerJoin(projects, eq(projects.id, environments.projectId)).where(inArray(projects.orgId, cluster.orgIds))
  const activeEnvironments = new Set(definitions.map((item) => item.route.environmentId))
  for (const environment of clusterEnvironments) {
    if (!activeEnvironments.has(environment.id)) {
      await db.delete(managedProxies).where(eq(managedProxies.environmentId, environment.id))
      continue
    }
    await db.insert(managedProxies).values({ environmentId: environment.id, trellisJobName: spec.name, status: 'pending', port: httpPort, configHash: hash })
      .onConflictDoUpdate({ target: managedProxies.environmentId, set: { trellisJobName: spec.name, status: 'pending', port: httpPort, configHash: hash, updatedAt: new Date() } })
  }
}

export async function reconcileManagedIngress() {
  const seen = new Set<string>()
  for (const org of await db.select().from(organizations)) {
    if (!hasTrellisConnection(org)) continue
    try {
      const cluster = await getIngressCluster(org.id)
      if (seen.has(cluster.address)) continue
      seen.add(cluster.address)
      await syncManagedProxy('', '', org.id)
    } catch (error) { console.error('Bower shared ingress reconciliation failed:', { orgId: org.id, message: trellisReadError(error) }) }
  }
}
