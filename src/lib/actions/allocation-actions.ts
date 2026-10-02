'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments, serviceConfigs } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireService } from '@/lib/actions/shared'
import { allocationBelongsToService } from '@/lib/trellis-runtime'

async function getOwnedAllocation(serviceId: string, allocationId: string) {
  const access = await requireService(serviceId)
  const configs = await db.select({
    activeJobName: serviceConfigs.activeJobName,
    namespace: environments.trellisNamespace,
  })
    .from(serviceConfigs)
    .innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .where(eq(serviceConfigs.serviceId, serviceId))
  const client = await getTrellisClient(access.org.id)
  const results = await Promise.allSettled(configs.map((config) => client.listAllocations({ namespace: config.namespace })))
  const allocations = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  const allocation = allocations.find((item) => item.id === allocationId && configs.some((config) =>
    allocationBelongsToService(item, config.namespace, access.service.slug, [access.service.slug, config.activeJobName])))
  if (!allocation) {
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    throw new Error('Allocation not found.')
  }

  return { access, allocation }
}

export async function getAllocationMetricsAction(serviceId: string, allocationId: string) {
  const { access, allocation } = await getOwnedAllocation(serviceId, allocationId)
  const client = await getTrellisClient(access.org.id)
  return client.getAllocationMetrics(allocationId, allocation.namespace)
}

export async function getAllocationLogsAction(serviceId: string, allocationId: string, task: string) {
  const { access, allocation } = await getOwnedAllocation(serviceId, allocationId)
  const client = await getTrellisClient(access.org.id)
  return client.getAllocationLogs(allocationId, task, allocation.namespace)
}

export async function stopAllocationDetailAction(serviceId: string, allocationId: string) {
  const { access, allocation } = await getOwnedAllocation(serviceId, allocationId)
  if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  if (allocation.phase === 'stopped' || allocation.phase === 'stopping' || allocation.phase === 'lost') return

  const client = await getTrellisClient(access.org.id)
  await client.stopAllocation(allocationId, allocation.namespace)
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
