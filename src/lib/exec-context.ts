import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { serviceConfigs, environments } from '@/db/schema'
import { requireService } from '@/lib/actions/shared'
import { getTrellisClient } from '@/lib/trellis-instance'
import { assertExecAllocation } from '@/lib/exec-ownership'

// Not a server action: this context includes credentials and must never be
// serializable to a browser. Only the private bridge endpoint consumes it.
export async function getExecSessionContext(serviceConfigId: string, allocationId?: string) {
  const [row] = await db.select({ config: serviceConfigs, environment: environments })
    .from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .where(eq(serviceConfigs.id, serviceConfigId)).limit(1)
  if (!row) throw new Error('Service configuration not found.')
  const access = await requireService(row.config.serviceId)
  if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  if (row.environment.projectId !== access.project.id) throw new Error('Environment does not belong to this project.')
  const namespace = row.environment.trellisNamespace
  const client = await getTrellisClient(access.org.id)
  if (allocationId) {
    const allocations = await client.listAllocations({ namespace })
    assertExecAllocation(allocations, allocationId, namespace, access.service.slug, row.config.activeJobName)
  }
  return { access, client, namespace }
}
