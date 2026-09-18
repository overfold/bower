import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { invitations, invitationTeams, organizationMembers, teamMemberships, users } from '@/db/schema'
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
}) {
  if (invitation.revokedAt) return 'revoked' as const
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) return 'expired' as const
  if (!invitation.reusable && invitation.usedAt) return 'used' as const
  return 'active' as const
}

export async function getInvitationByToken(token: string) {
  const [invitation] = await db.select().from(invitations)
    .where(eq(invitations.tokenHash, hashInvitationToken(token))).limit(1)
  return invitation ?? null
}

export async function acceptInvitation(token: string, userId: string): Promise<{ error?: string; orgId?: string | null }> {
  const tokenHash = hashInvitationToken(token)
  const now = new Date()

  return db.transaction(async (tx) => {
    const [invitation] = await tx.select().from(invitations)
      .where(eq(invitations.tokenHash, tokenHash)).limit(1)
    if (!invitation) return { error: 'This invitation is invalid.' }
    if (invitation.revokedAt) return { error: 'This invitation has been revoked.' }
    if (invitation.expiresAt && invitation.expiresAt <= now) return { error: 'This invitation has expired.' }

    if (!invitation.reusable) {
      const claimed = await tx.update(invitations).set({ usedByUserId: userId, usedAt: now })
        .where(and(eq(invitations.id, invitation.id), isNull(invitations.usedAt), isNull(invitations.revokedAt)))
        .returning({ id: invitations.id })
      if (claimed.length === 0) return { error: 'This invitation has already been accepted.' }
    }

    if (invitation.grantInstanceAdmin) {
      await tx.update(users).set({ isInstanceAdmin: true, updatedAt: now }).where(eq(users.id, userId))
    }

    if (invitation.orgId && invitation.organizationRole) {
      await tx.insert(organizationMembers).values({
        orgId: invitation.orgId,
        userId,
        role: invitation.organizationRole,
      }).onConflictDoUpdate({
        target: [organizationMembers.orgId, organizationMembers.userId],
        set: { role: invitation.organizationRole },
      })

      const teams = await tx.select({ teamId: invitationTeams.teamId }).from(invitationTeams)
        .where(eq(invitationTeams.invitationId, invitation.id))
      if (teams.length) {
        await tx.insert(teamMemberships).values(teams.map(({ teamId }) => ({ teamId, userId }))).onConflictDoNothing()
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
