import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, organizationMembers, projects, services } from '@/db/schema'
import { getProjectRole } from '@/lib/actions/shared'
import { isInstanceAdmin } from '@/lib/queries'

export async function authenticateApiKeyToken(header: string | null) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex'); const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1)
  return key ?? null
}

export async function authenticateApiKey(header: string | null, serviceId: string) {
  const key = await authenticateApiKeyToken(header); if (!key) return null
  const [row] = await db.select({ service: services, project: projects }).from(services).innerJoin(projects, eq(projects.id, services.projectId)).where(and(eq(services.id, serviceId), eq(projects.orgId, key.orgId))).limit(1); if (!row) return null
  const [membership] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, key.orgId), eq(organizationMembers.userId, key.userId))).limit(1)
  // Match interactive authorization: explicit membership wins; instance admins
  // have synthetic owner access only when they have no explicit membership.
  const orgRole = membership?.role ?? (await isInstanceAdmin(key.userId) ? 'owner' : null)
  if (!orgRole) return null
  const projectRole = await getProjectRole(key.userId, orgRole, row.project.id)
  if (projectRole !== 'admin' && projectRole !== 'deployer') return null
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)); return { key, ...row, actor: { actorType: 'api_key' as const, apiKeyId: key.id, userId: key.userId } }
}
