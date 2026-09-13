'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizations, users, organizationTokens, organizationMembers, apiKeys } from '@/db/schema'
import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { getUserOrganization, isInstanceAdmin } from '@/lib/queries'
import { recordAudit } from './shared'

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
  const slugValue = formData.get('slug')
  const trellisApiUrl = formData.get('trellisApiUrl')
  const trellisApiToken = formData.get('trellisApiToken')
  if ([name, slugValue, trellisApiUrl, trellisApiToken].some((value) => typeof value !== 'string' || !value.trim())) {
    return { error: 'Name, slug, Trellis API URL, and Trellis API token are required.' }
  }

  const slug = (slugValue as string).trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'Slug must contain lowercase letters, numbers, and single hyphens only.' }
  }

  const existing = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1)
  if (existing.length) return { error: 'An organization with this slug already exists.' }

  await db.insert(organizations).values({
    name: (name as string).trim(),
    slug,
    trellisApiUrl: (trellisApiUrl as string).trim(),
    trellisApiToken: (trellisApiToken as string).trim(),
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
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role !== 'owner') return { error: 'Only organization owners can change member roles.' }

  const [membership] = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.id, membershipId), eq(organizationMembers.orgId, ctx.org.id))).limit(1)
  if (!membership) return { error: 'Member not found.' }

  if (membership.role === 'owner' && role !== 'owner') {
    const owners = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, ctx.org.id), eq(organizationMembers.role, 'owner')))
    if (owners.length <= 1) return { error: 'An organization must have at least one owner.' }
  }

  await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, membershipId))
  await recordAudit({
    orgId: ctx.org.id,
    userId: user.id,
    action: 'organization.member.role_changed',
    resourceType: 'organization',
    resourceId: ctx.org.id,
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

export async function createInviteTokenAction(
  role: 'owner' | 'admin' | 'member',
  note?: string,
): Promise<{ error?: string; token?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }
  if (role === 'owner' && ctx.role !== 'owner') return { error: 'Only owners can create owner-level invitations.' }

  const rawToken = `ci_${randomBytes(24).toString('base64url')}`
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const tokenPrefix = rawToken.slice(0, 11)

  await db.insert(organizationTokens).values({
    orgId: ctx.org.id,
    tokenHash,
    tokenPrefix,
    role,
    note: note?.trim() || null,
    createdByUserId: user.id,
  })

  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'invite_token.created', resourceType: 'invite_token', resourceId: tokenPrefix, details: { role, note } })
  revalidatePath('/settings/members')
  return { token: rawToken }
}

export async function revokeInviteTokenAction(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return { error: 'No organization found.' }
  if (ctx.role === 'member') return { error: 'Insufficient permissions.' }

  const [token] = await db.select().from(organizationTokens)
    .where(and(eq(organizationTokens.id, id), eq(organizationTokens.orgId, ctx.org.id))).limit(1)
  if (!token) return { error: 'Invitation not found.' }
  if (token.usedAt) return { error: 'Cannot revoke an invitation that has already been used.' }

  await db.delete(organizationTokens).where(eq(organizationTokens.id, id))
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'invite_token.revoked', resourceType: 'invite_token', resourceId: id, details: { prefix: token.tokenPrefix } })
  revalidatePath('/settings/members')
  return { success: true }
}
