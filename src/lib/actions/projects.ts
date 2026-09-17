'use server'

import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { projects, environments, services, teams, teamProjectAccess } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { recordAudit, requireProject } from './shared'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63) || 'project'
}

export async function createProjectAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }

  const name = formData.get('name')
  const description = formData.get('description')
  const owningTeamId = String(formData.get('owningTeamId') ?? '') || null
  if (owningTeamId) {
    const [team] = await db.select().from(teams).where(and(eq(teams.id, owningTeamId), eq(teams.orgId, ctx.org.id))).limit(1)
    if (!team) return { error: 'Owning team not found.' }
  }

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Project name is required.' }
  }

  const slug = slugify(name.trim())

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, ctx.org.id), eq(projects.slug, slug)))
    .limit(1)

  if (existing.length > 0) {
    return { error: 'A project with this name already exists.' }
  }

  const [project] = await db
    .insert(projects)
    .values({
      orgId: ctx.org.id,
      name: name.trim(),
      slug,
      description: typeof description === 'string' ? description.trim() || null : null,
      owningTeamId,
      registryUrl: String(formData.get('registryUrl') ?? '').trim() || null,
    })
    .returning({ id: projects.id, slug: projects.slug })

  await db.insert(environments).values({
    projectId: project.id,
    name: 'Production',
    slug: 'production',
    trellisNamespace: `${slug}-production`,
    promotionOrder: 0,
  })
  if (owningTeamId) await db.insert(teamProjectAccess).values({ teamId: owningTeamId, projectId: project.id, role: 'admin' }).onConflictDoUpdate({ target: [teamProjectAccess.teamId, teamProjectAccess.projectId], set: { role: 'admin' } })

  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'project.created', resourceType: 'project', resourceId: project.id, details: { name: name.trim(), slug, owningTeamId } })

  redirect(`/projects/${project.slug}`)
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const owningTeamId = String(formData.get('owningTeamId') ?? '') || null
  if (owningTeamId) {
    const [team] = await db.select().from(teams).where(and(eq(teams.id, owningTeamId), eq(teams.orgId, ctx.org.id))).limit(1); if (!team) throw new Error('Owning team not found.')
  }
  const after = { name: String(formData.get('name') ?? '').trim() || ctx.project.name, description: String(formData.get('description') ?? '').trim() || null, owningTeamId, registryUrl: String(formData.get('registryUrl') ?? '').trim() || null, updatedAt: new Date() }
  await db.update(projects).set(after).where(eq(projects.id, projectId)); await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'project.updated', resourceType: 'project', resourceId: projectId, details: { before: ctx.project, after } })
  if (owningTeamId) await db.insert(teamProjectAccess).values({ teamId: owningTeamId, projectId, role: 'admin' }).onConflictDoUpdate({ target: [teamProjectAccess.teamId, teamProjectAccess.projectId], set: { role: 'admin' } })
  redirect(`/projects/${ctx.project.slug}/settings`)
}

export async function deleteProjectAction(
  projectId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }

  const [service] = await db.select({ id: services.id }).from(services)
    .where(eq(services.projectId, projectId)).limit(1)
  const [environment] = await db.select({ id: environments.id }).from(environments)
    .where(eq(environments.projectId, projectId)).limit(1)
  if (service || environment) return { error: 'Delete every service and environment before deleting this project.' }

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, ctx.org.id)))

  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'project.deleted', resourceType: 'project', resourceId: projectId })

  redirect('/projects')
}
