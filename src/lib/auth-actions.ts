'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { db } from '@/db'
import { users, organizations, organizationMembers, organizationTokens, instanceTokens } from '@/db/schema'
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getSessionCookieConfig,
  SESSION_COOKIE_NAME,
} from '@/lib/auth'
import { recordAudit } from '@/lib/actions/shared'
import { ORG_COOKIE_NAME } from '@/lib/constants'

export async function loginAction(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password
  ) {
    return { error: 'Email and password are required.' }
  }

  const normalizedEmail = email.toLowerCase().trim()

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (userRows.length === 0) {
    return { error: 'Invalid email or password.' }
  }

  const user = userRows[0]
  const passwordValid = await verifyPassword(password, user.passwordHash)

  if (!passwordValid) {
    return { error: 'Invalid email or password.' }
  }

  const { token, expiresAt } = await createSession(user.id)
  const cookieStore = await cookies()
  cookieStore.set(getSessionCookieConfig(token, expiresAt))

  redirect('/dashboard')
}

export async function registerAction(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email')
  const password = formData.get('password')
  const name = formData.get('name')
  const inviteToken = formData.get('inviteToken')

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof name !== 'string' ||
    typeof inviteToken !== 'string' ||
    !email ||
    !password ||
    !name ||
    !inviteToken
  ) {
    return { error: 'Name, email, password, and invite token are required.' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const trimmedName = name.trim()
  const trimmedToken = inviteToken.trim()

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const tokenHash = createHash('sha256').update(trimmedToken).digest('hex')

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existingUsers.length > 0) {
    return { error: 'An account with this email already exists.' }
  }

  const passwordHash = await hashPassword(password)

  const instanceRows = await db
    .select()
    .from(instanceTokens)
    .where(eq(instanceTokens.tokenHash, tokenHash))
    .limit(1)

  if (instanceRows.length > 0) {
    const instance = instanceRows[0]
    if (instance.usedAt) return { error: 'This token has already been used.' }
    if (instance.expiresAt && instance.expiresAt < new Date()) return { error: 'This token has expired.' }

    const [newUser] = await db
      .insert(users)
      .values({ email: normalizedEmail, name: trimmedName, passwordHash, isInstanceAdmin: true })
      .returning({ id: users.id })

    await db
      .update(instanceTokens)
      .set({ usedByUserId: newUser.id, usedAt: new Date() })
      .where(eq(instanceTokens.id, instance.id))

    const [firstOrg] = await db.select({ id: organizations.id }).from(organizations).limit(1)
    if (firstOrg) {
      await recordAudit({
        orgId: firstOrg.id, userId: newUser.id,
        action: 'user.registered', resourceType: 'user', resourceId: newUser.id,
        details: { name: trimmedName, instanceAdmin: true, tokenPrefix: instance.tokenPrefix },
      })
    }

    const { token, expiresAt } = await createSession(newUser.id)
    const cookieStore = await cookies()
    cookieStore.set(getSessionCookieConfig(token, expiresAt))
    redirect('/dashboard')
  }

  const orgTokenRows = await db
    .select()
    .from(organizationTokens)
    .where(eq(organizationTokens.tokenHash, tokenHash))
    .limit(1)

  if (orgTokenRows.length === 0) return { error: 'Invalid token.' }

  const invite = orgTokenRows[0]
  if (invite.usedAt) return { error: 'This token has already been used.' }
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: 'This token has expired.' }

  const [newUser] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: trimmedName, passwordHash })
    .returning({ id: users.id })

  await db.insert(organizationMembers).values({
    orgId: invite.orgId, userId: newUser.id, role: invite.role,
  })

  await db
    .update(organizationTokens)
    .set({ usedByUserId: newUser.id, usedAt: new Date() })
    .where(eq(organizationTokens.id, invite.id))

  await recordAudit({
    orgId: invite.orgId, userId: newUser.id,
    action: 'user.registered', resourceType: 'user', resourceId: newUser.id,
    details: { name: trimmedName, role: invite.role, tokenPrefix: invite.tokenPrefix },
  })

  const { token, expiresAt } = await createSession(newUser.id)
  const cookieStore = await cookies()
  cookieStore.set(getSessionCookieConfig(token, expiresAt))

  redirect('/dashboard')
}

export async function switchOrgAction(orgId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set({
    name: ORG_COOKIE_NAME,
    value: orgId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (sessionCookie?.value) await deleteSession(sessionCookie.value)
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/login')
}
