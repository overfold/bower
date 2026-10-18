import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, environments, organizationMembers, projects, services } from '@/db/schema'
import { getProjectRole } from '@/lib/actions/shared'
import { isInstanceAdmin } from '@/lib/queries'
import type { ApiKeyScope } from '@/lib/api-key-scopes'

export { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'

export async function authenticateApiKeyToken(header: string | null) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex'); const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1)
  return key && (!key.expiresAt || key.expiresAt > new Date()) ? key : null
}

export async function authorizeApiKeyProject(key: typeof apiKeys.$inferSelect, projectId: string, scope: ApiKeyScope, environmentId?: string) {
  if (!key.scopes.includes(scope) || (key.projectId && key.projectId !== projectId)) return null
  if (key.environmentId && environmentId !== key.environmentId) return null
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.orgId, key.orgId))).limit(1)
  if (!project) return null
  if (environmentId) {
    const [environment] = await db.select({ id: environments.id }).from(environments)
      .where(and(eq(environments.id, environmentId), eq(environments.projectId, project.id))).limit(1)
    if (!environment) return null
  }
  const [membership] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, key.orgId), eq(organizationMembers.userId, key.userId))).limit(1)
  // Match interactive authorization: explicit membership wins; instance admins
  // have synthetic owner access only when they have no explicit membership.
  const orgRole = membership?.role ?? (await isInstanceAdmin(key.userId) ? 'owner' : null)
  if (!orgRole) return null
  const projectRole = await getProjectRole(key.userId, orgRole, project.id)
  if (!projectRole || (scope !== 'read' && projectRole === 'viewer')) return null
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id))
  return { key, project, projectRole, actor: { actorType: 'api_key' as const, apiKeyId: key.id, userId: key.userId } }
}

export async function authenticateApiKey(header: string | null, serviceId: string, environmentId?: string, scope: ApiKeyScope = 'deploy') {
  const key = await authenticateApiKeyToken(header); if (!key) return null
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1)
  if (!service) return null
  const access = await authorizeApiKeyProject(key, service.projectId, scope, environmentId)
  return access ? { ...access, service } : null
}
