'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments, serviceDeployments } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireService } from '@/lib/actions/shared'

async function getOwnedAllocation(serviceId: string, allocationId: string) {
  const access = await requireService(serviceId)
  const [allocations, targets] = await Promise.all([
    getTrellisClient(access.org.id).then((client) => client.listAllocations()),
    db.select({
      activeJobName: serviceDeployments.activeJobName,
      namespace: environments.trellisNamespace,
    })
      .from(serviceDeployments)
      .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
      .where(eq(serviceDeployments.serviceId, serviceId)),
  ])
  const allocation = allocations.find((item) => item.id === allocationId)
  if (!allocation) throw new Error('Allocation not found.')

  const knownJobs = new Set([access.service.slug, ...targets.map((item) => item.activeJobName).filter((value): value is string => Boolean(value))])
  const knownNamespaces = new Set(targets.map((item) => item.namespace))
  const managedService = allocation.labels?.['bower/service']
  if (!knownNamespaces.has(allocation.namespace) || (managedService !== access.service.slug && !knownJobs.has(allocation.job))) {
    throw new Error('Allocation not found.')
  }

  return { access, allocation }
}

export async function getAllocationMetricsAction(serviceId: string, allocationId: string) {
  const { access } = await getOwnedAllocation(serviceId, allocationId)
  const client = await getTrellisClient(access.org.id)
  return client.getAllocationMetrics(allocationId)
}

export async function stopAllocationDetailAction(serviceId: string, allocationId: string) {
  const { access, allocation } = await getOwnedAllocation(serviceId, allocationId)
  if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  if (allocation.phase === 'stopped' || allocation.phase === 'stopping' || allocation.phase === 'lost') return

  const client = await getTrellisClient(access.org.id)
  await client.stopAllocation(allocationId)
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'allocation.stopped',
    resourceType: 'allocation',
    resourceId: allocationId,
    details: { serviceId, job: allocation.job, namespace: allocation.namespace },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/allocations/${allocationId}`)
}
