import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { invitations, invitationTeams, organizationMembers, organizations, teams, teamMemberships, users } from '@/db/schema'
import { recordAudit } from '@/lib/actions/shared'

export function createInvitationToken() {
  return randomBytes(32).toString('base64url')
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function invitationStatus(invitation: {
  reusable: boolean
  usedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  maxUses: number | null
  useCount: number
}) {
  if (invitation.revokedAt) return 'revoked' as const
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) return 'expired' as const
  if (!invitation.reusable && invitation.usedAt) return 'used' as const
  if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) return 'used' as const
  return 'active' as const
}

export async function getInvitationByToken(token: string) {
  const [row] = await db.select({ invitation: invitations, organizationName: organizations.name, inviterName: users.name }).from(invitations)
    .leftJoin(organizations, eq(organizations.id, invitations.orgId))
    .leftJoin(users, eq(users.id, invitations.createdByUserId))
    .where(eq(invitations.tokenHash, hashInvitationToken(token))).limit(1)
  return row ? { ...row.invitation, organizationName: row.organizationName, inviterName: row.inviterName } : null
}

export async function acceptInvitation(token: string, userId: string): Promise<{ error?: string; orgId?: string | null }> {
  const tokenHash = hashInvitationToken(token)
  const now = new Date()

  return db.transaction(async (tx) => {
    const [invitation] = await tx.select().from(invitations)
      .where(eq(invitations.tokenHash, tokenHash)).limit(1).for('update')
    if (!invitation) return { error: 'This invitation is invalid.' }
    if (invitation.revokedAt) return { error: 'This invitation has been revoked.' }
    if (invitation.expiresAt && invitation.expiresAt <= now) return { error: 'This invitation has expired.' }
    if ((!invitation.reusable && invitation.usedAt) || (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses)) {
      return { error: 'This invitation has reached its use limit.' }
    }
    await tx.update(invitations).set({ usedByUserId: userId, usedAt: now, useCount: invitation.useCount + 1 })
      .where(eq(invitations.id, invitation.id))

    if (invitation.grantInstanceAdmin) {
      await tx.update(users).set({ isInstanceAdmin: true, updatedAt: now }).where(eq(users.id, userId))
    }

    if (invitation.orgId && invitation.organizationRole) {
      await tx.insert(organizationMembers).values({
        orgId: invitation.orgId,
        userId,
        role: invitation.organizationRole,
      }).onConflictDoNothing({
        target: [organizationMembers.orgId, organizationMembers.userId],
      })

      const eligibleTeams = await tx.select({ teamId: invitationTeams.teamId }).from(invitationTeams)
        .innerJoin(teams, and(eq(teams.id, invitationTeams.teamId), eq(teams.orgId, invitation.orgId)))
        .where(eq(invitationTeams.invitationId, invitation.id))
      if (eligibleTeams.length > 0) {
        await tx.insert(teamMemberships).values(eligibleTeams.map(({ teamId }) => ({ teamId, userId }))).onConflictDoNothing()
      }
    }

    if (invitation.orgId) {
      await recordAudit({
        orgId: invitation.orgId,
        userId,
        action: 'invitation.accepted',
        resourceType: 'invitation',
        resourceId: invitation.id,
        details: { reusable: invitation.reusable, organizationRole: invitation.organizationRole, grantInstanceAdmin: invitation.grantInstanceAdmin },
      })
    }

    return { orgId: invitation.orgId }
  })
}
