'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { organizations, users, invitations, invitationTeams, organizationMembers, apiKeys, teams } from '@/db/schema'
import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { getUserOrganization, isInstanceAdmin } from '@/lib/queries'
import { recordAudit } from './shared'
import { acceptInvitation, createInvitationToken, hashInvitationToken } from '@/lib/invitations'

export async function updateOrganizationAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }

  const name = formData.get('name')
  const trellisApiUrl = formData.get('trellisApiUrl')
  const trellisApiToken = formData.get('trellisApiToken')
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof name === 'string' && name.trim()) updates.name = name.trim()
  if (typeof trellisApiUrl === 'string') updates.trellisApiUrl = trellisApiUrl.trim()
  if (typeof trellisApiToken === 'string' && trellisApiToken.trim()) updates.trellisApiToken = trellisApiToken.trim()

  await db.update(organizations).set(updates).where(eq(organizations.id, ctx.org.id))
  await recordAudit({
    orgId: ctx.org.id,
    userId: user.id,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: ctx.org.id,
    details: {
      before: { name: ctx.org.name, trellisApiUrl: ctx.org.trellisApiUrl },
      after: { name: updates.name, trellisApiUrl: updates.trellisApiUrl, tokenChanged: Boolean(updates.trellisApiToken) },
    },
  })

  return { success: true }
}

export async function createOrganizationAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!(await isInstanceAdmin(user.id))) return { error: 'Instance administrator access required.' }

  const name = formData.get('name')
  const trellisApiUrl = formData.get('trellisApiUrl')
  const trellisApiToken = formData.get('trellisApiToken')
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Name is required.' }
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63)
  if (!slug) return { error: 'Name must contain at least one letter or number.' }

  const existing = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1)
  if (existing.length) return { error: 'An organization with this slug already exists.' }

  await db.insert(organizations).values({
    name: (name as string).trim(),
    slug,
    trellisApiUrl: typeof trellisApiUrl === 'string' ? trellisApiUrl.trim() : '',
    trellisApiToken: typeof trellisApiToken === 'string' ? trellisApiToken.trim() : '',
  })

  revalidatePath('/settings/instance')
  return { success: true }
}

export async function updateOrganizationMemberRoleAction(
  membershipId: string,
  role: 'owner' | 'admin' | 'member',
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const requesterIsInstanceAdmin = await isInstanceAdmin(user.id)
  const ctx = await getUserOrganization(user.id)
  if (!requesterIsInstanceAdmin && !ctx) return { error: 'No organization found.' }
  if (!requesterIsInstanceAdmin && ctx?.role !== 'owner') {
    return { error: 'Only organization owners can change member roles.' }
  }

  const [membership] = await db.select().from(organizationMembers)
    .where(eq(organizationMembers.id, membershipId)).limit(1)
  if (!membership) return { error: 'Member not found.' }
  if (!requesterIsInstanceAdmin && membership.orgId !== ctx?.org.id) {
    return { error: 'Member not found.' }
  }

  if (membership.role === 'owner' && role !== 'owner') {
    const owners = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, membership.orgId), eq(organizationMembers.role, 'owner')))
    if (owners.length <= 1) return { error: 'An organization must have at least one owner.' }
  }

  await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, membershipId))
  await recordAudit({
    orgId: membership.orgId,
    userId: user.id,
    action: 'organization.member.role_changed',
    resourceType: 'organization',
    resourceId: membership.orgId,
    details: { membershipId, before: membership.role, after: role },
  })
  revalidatePath('/settings/members')
  return { success: true }
}

export async function removeOrganizationMemberAction(
  membershipId: string,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role !== 'owner') return { error: 'Only organization owners can remove members.' }

  const [membership] = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.id, membershipId), eq(organizationMembers.orgId, ctx.org.id))).limit(1)
  if (!membership) return { error: 'Member not found.' }
  if (membership.userId === user.id) return { error: 'You cannot remove yourself from the organization here.' }

  if (membership.role === 'owner') {
    const owners = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, ctx.org.id), eq(organizationMembers.role, 'owner')))
    if (owners.length <= 1) return { error: 'An organization must have at least one owner.' }
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.id, membershipId))
  await recordAudit({
    orgId: ctx.org.id,
    userId: user.id,
    action: 'organization.member.removed',
    resourceType: 'organization',
    resourceId: ctx.org.id,
    details: { membershipId, memberUserId: membership.userId },
  })
  revalidatePath('/settings/members')
  return { success: true }
}

export async function updateAccountAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const name = formData.get('name')
  const email = formData.get('email')
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof name === 'string' && name.trim()) updates.name = name.trim()
  if (typeof email === 'string' && email.trim()) updates.email = email.toLowerCase().trim()

  await db.update(users).set(updates).where(eq(users.id, user.id))
  const ctx = await getUserOrganization(user.id)
  if (ctx) await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'account.updated', resourceType: 'user', resourceId: user.id, details: { name: updates.name, email: updates.email } })
  return { success: true }
}

export async function changePasswordAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }

  const currentPassword = formData.get('currentPassword')
  const newPassword = formData.get('newPassword')
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return { error: 'Both passwords are required.' }
  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.' }

  const userRows = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  if (userRows.length === 0) return { error: 'User not found.' }
  if (!(await verifyPassword(currentPassword, userRows[0].passwordHash))) return { error: 'Current password is incorrect.' }

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id))
  const ctx = await getUserOrganization(user.id)
  if (ctx) await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'account.password.changed', resourceType: 'user', resourceId: user.id })
  return { success: true }
}

export async function createApiKeyAction(name: string) {
  const user = await getCurrentUser(); if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id); if (!ctx) return { error: 'No organization found.' }
  if (!name.trim()) return { error: 'Key name is required.' }
  const token = `bower_${randomBytes(24).toString('base64url')}`
  const [key] = await db.insert(apiKeys).values({ orgId: ctx.org.id, userId: user.id, name: name.trim(),
    keyHash: createHash('sha256').update(token).digest('hex'), keyPrefix: token.slice(0, 13) }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'api_key.created', resourceType: 'api_key', resourceId: key.id, details: { name: key.name, prefix: key.keyPrefix } })
  revalidatePath('/settings/account'); return { token }
}

export async function revokeApiKeyAction(id: string) {
  const user = await getCurrentUser(); if (!user) return
  const ctx = await getUserOrganization(user.id)
  const [key] = await db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id))).limit(1)
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
  if (ctx && key) await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'api_key.revoked', resourceType: 'api_key', resourceId: id, details: { name: key.name } })
  revalidatePath('/settings/account')
}

export async function createInvitationAction(input: {
  role: 'owner' | 'admin' | 'member' | null
  grantInstanceAdmin: boolean
  reusable: boolean
  teamIds: string[]
  note?: string
  expiresAt?: string
}): Promise<{ error?: string; inviteUrl?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }
  if (input.role === 'owner' && ctx.role !== 'owner' && !(await isInstanceAdmin(user.id))) return { error: 'Only owners can create owner-level invitations.' }
  if (!input.role && !input.grantInstanceAdmin) return { error: 'An invitation must grant organization or instance access.' }
  if (input.reusable && input.role !== 'member') return { error: 'Reusable invitations can only grant the Member role.' }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: 'Invalid expiration date.' }
  if (expiresAt && expiresAt <= new Date()) return { error: 'Expiration must be in the future.' }
  const validTeams = input.teamIds.length ? await db.select({ id: teams.id }).from(teams)
    .where(and(eq(teams.orgId, ctx.org.id), inArray(teams.id, input.teamIds))) : []
  if (validTeams.length !== input.teamIds.length) return { error: 'One or more selected teams do not belong to this organization.' }

  const rawToken = createInvitationToken()
  const [invitation] = await db.insert(invitations).values({
    orgId: ctx.org.id,
    tokenHash: hashInvitationToken(rawToken),
    organizationRole: input.role,
    grantInstanceAdmin: input.grantInstanceAdmin,
    reusable: input.reusable,
    note: input.note?.trim() || null,
    expiresAt,
    createdByUserId: user.id,
  }).returning()
  if (validTeams.length) await db.insert(invitationTeams).values(validTeams.map(({ id }) => ({ invitationId: invitation.id, teamId: id })))
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'invitation.created', resourceType: 'invitation', resourceId: invitation.id, details: { role: input.role, reusable: input.reusable, grantInstanceAdmin: input.grantInstanceAdmin } })
  revalidatePath('/settings/members')
  return { inviteUrl: `/invite/${rawToken}` }
}

export async function revokeInvitationAction(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }

  const [invitation] = await db.select().from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.orgId, ctx.org.id))).limit(1)
  if (!invitation) return { error: 'Invitation not found.' }
  if (invitation.revokedAt) return { error: 'Invitation is already revoked.' }
  await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, id))
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'invitation.revoked', resourceType: 'invitation', resourceId: id })
  revalidatePath('/settings/members')
  return { success: true }
}

export async function toggleInstanceAdminAction(
  email: string,
  promote: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!(await isInstanceAdmin(user.id))) return { error: 'Instance administrator access required.' }

  const [target] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!target) return { error: 'No registered user has that email.' }
  if (!promote && target.id === user.id) return { error: 'You cannot remove your own instance admin access.' }

  await db.update(users).set({ isInstanceAdmin: promote, updatedAt: new Date() }).where(eq(users.id, target.id))
  revalidatePath('/settings/instance')
  return { success: true }
}

export async function acceptInvitationAction(token: string): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const result = await acceptInvitation(token, user.id)
  if (result.error) return result
  revalidatePath('/settings/members')
  return { success: true }
}
