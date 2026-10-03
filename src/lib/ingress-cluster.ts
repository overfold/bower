import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { organizations, projects, routes } from '@/db/schema'
import { hasTrellisConnection, resolveTrellisConnection } from '@/lib/trellis-connection'
import { hostnamesOverlap } from '@/lib/domains'

export function clusterAddress(address: string) {
  const value = address.trim().replace(/\/+$/, '')
  return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin
}

export function ingressNamespace() {
  return process.env.BOWER_PROXY_NAMESPACE || 'platform'
}

export function ingressSecretName(namespace: string, name: string) {
  return `BOWER_TLS_${createHash('sha256').update(JSON.stringify([namespace, name])).digest('hex')}`
}

// Organizations using the same API endpoint share one ingress, regardless of
// whether their connection uses workload identity or durable credentials.
export async function getIngressCluster(orgId: string) {
  const { db } = await import('@/db')
  const connected = (await db.select().from(organizations)).filter((org) => hasTrellisConnection(org))
  const org = connected.find((item) => item.id === orgId)
  if (!org) throw new Error('Trellis credentials have not been configured for this organization.')
  const address = clusterAddress(resolveTrellisConnection(org).apiUrl)
  return {
    orgIds: connected.filter((item) => clusterAddress(resolveTrellisConnection(item).apiUrl) === address).map((item) => item.id),
    address,
    home: Boolean(process.env.TRELLIS_ADDR || process.env.TRELLIS_API_URL) &&
      address === clusterAddress(process.env.TRELLIS_ADDR || process.env.TRELLIS_API_URL!),
  }
}

export async function assertIngressHostname(orgId: string, projectId: string, environmentId: string, hostname: string, routeId?: string) {
  const { db } = await import('@/db')
  const cluster = await getIngressCluster(orgId)
  const dashboard = process.env.BOWER_PUBLIC_URL
  if (cluster.home && dashboard && hostnamesOverlap(hostname, new URL(dashboard).hostname)) {
    throw new Error('This hostname is reserved for the Bower dashboard.')
  }
  const bindings = await db.select({ route: routes }).from(routes)
    .innerJoin(projects, eq(projects.id, routes.projectId)).where(inArray(projects.orgId, cluster.orgIds))
  if (bindings.some(({ route }) => route.id !== routeId && hostnamesOverlap(route.domain, hostname) &&
    (route.projectId !== projectId || route.environmentId !== environmentId))) {
    throw new Error('This hostname overlaps another environment on the same Trellis cluster.')
  }
}
