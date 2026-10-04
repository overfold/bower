import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, organizationMembers, projects, projectUserAccess, teamMemberships, teams } from '@/db/schema'

// Authorization belongs to the calling action. All organization-scoped access
// is removed atomically; team-wide project grants themselves belong to the team.
export async function revokeOrganizationMembership(membership: { id: string; orgId: string; userId: string }) {
  await db.transaction(async (tx) => {
    await tx.delete(apiKeys).where(and(eq(apiKeys.orgId, membership.orgId), eq(apiKeys.userId, membership.userId)))
    await tx.delete(teamMemberships).where(and(eq(teamMemberships.userId, membership.userId),
      inArray(teamMemberships.teamId, tx.select({ id: teams.id }).from(teams).where(eq(teams.orgId, membership.orgId)))))
    await tx.delete(projectUserAccess).where(and(eq(projectUserAccess.userId, membership.userId),
      inArray(projectUserAccess.projectId, tx.select({ id: projects.id }).from(projects).where(eq(projects.orgId, membership.orgId)))))
    await tx.delete(organizationMembers).where(and(eq(organizationMembers.id, membership.id), eq(organizationMembers.orgId, membership.orgId), eq(organizationMembers.userId, membership.userId)))
  })
}
