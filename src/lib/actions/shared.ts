import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { auditLog, projects, projectUserAccess, services, teamMemberships, teamProjectAccess } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { ORG_COOKIE_NAME } from '@/lib/constants'

export async function requireContext() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated.')
  const cookieStore = await cookies()
  const preferredOrgId = cookieStore.get(ORG_COOKIE_NAME)?.value ?? null
  const ctx = await getUserOrganization(user.id, preferredOrgId)
  if (!ctx) throw new Error('No organization found.')
  return { user, ...ctx }
}

export async function requireProject(projectId: string) {
  const ctx = await requireContext()
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, projectId), eq(projects.orgId, ctx.org.id),
  )).limit(1)
  if (!project) throw new Error('Project not found.')
  const projectRole = await getProjectRole(ctx.user.id, ctx.role, projectId)
  if (!projectRole) throw new Error('Project not found.')
  return { ...ctx, project, projectRole }
}

export async function requireService(serviceId: string) {
  const ctx = await requireContext()
  const [row] = await db.select({ service: services, project: projects })
    .from(services).innerJoin(projects, eq(projects.id, services.projectId))
    .where(and(eq(services.id, serviceId), eq(projects.orgId, ctx.org.id))).limit(1)
  if (!row) throw new Error('Service not found.')
  const projectRole = await getProjectRole(ctx.user.id, ctx.role, row.project.id)
  if (!projectRole) throw new Error('Service not found.')
  return { ...ctx, ...row, projectRole }
}

async function getProjectRole(userId: string, orgRole: 'owner' | 'admin' | 'member', projectId: string) {
  if (orgRole === 'owner' || orgRole === 'admin') return 'admin' as const
  const teamGrants = await db.select({ role: teamProjectAccess.role }).from(teamMemberships)
    .innerJoin(teamProjectAccess, eq(teamProjectAccess.teamId, teamMemberships.teamId))
    .where(and(eq(teamMemberships.userId, userId), eq(teamProjectAccess.projectId, projectId)))
  const userGrants = await db.select({ role: projectUserAccess.role }).from(projectUserAccess)
    .where(and(eq(projectUserAccess.userId, userId), eq(projectUserAccess.projectId, projectId)))
  const grants = [...teamGrants, ...userGrants]
  if (grants.some((grant) => grant.role === 'admin')) return 'admin' as const
  if (grants.some((grant) => grant.role === 'deployer')) return 'deployer' as const
  if (grants.some((grant) => grant.role === 'viewer')) return 'viewer' as const
  return null
}

export async function recordAudit(input: {
  orgId: string; userId: string | null; action: string; resourceType: string;
  resourceId: string; details?: Record<string, unknown>
}) {
  await db.insert(auditLog).values({
    orgId: input.orgId, userId: input.userId, action: input.action,
    resourceType: input.resourceType, resourceId: input.resourceId,
    details: input.details ?? {},
  })
}

export function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function integer(formData: FormData, key: string, fallback: number) {
  const value = Number(text(formData, key))
  return Number.isInteger(value) ? value : fallback
}
