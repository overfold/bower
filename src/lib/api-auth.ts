import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, organizationMembers, projects, services, teamMemberships, teamProjectAccess } from '@/db/schema'

export async function authenticateApiKey(header: string | null, serviceId: string) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex'); const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1); if (!key) return null
  const [row] = await db.select({ service: services, project: projects }).from(services).innerJoin(projects, eq(projects.id, services.projectId)).where(and(eq(services.id, serviceId), eq(projects.orgId, key.orgId))).limit(1); if (!row) return null
  const [membership] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, key.orgId), eq(organizationMembers.userId, key.userId))).limit(1)
  let allowed = membership?.role === 'owner' || membership?.role === 'admin'
  if (!allowed) {
    const grants = await db.select({ role: teamProjectAccess.role }).from(teamMemberships).innerJoin(teamProjectAccess, eq(teamProjectAccess.teamId, teamMemberships.teamId)).where(and(eq(teamMemberships.userId, key.userId), eq(teamProjectAccess.projectId, row.project.id)))
    allowed = grants.some((grant) => grant.role === 'admin' || grant.role === 'deployer')
  }
  if (!allowed) return null
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)); return { key, ...row }
}
