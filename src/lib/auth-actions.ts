'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getSessionCookieConfig,
  SESSION_COOKIE_NAME,
  PasswordWorkBusyError,
} from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { consumeAuthAttempt } from '@/lib/auth-abuse'

// Valid cost-12 hash: absent accounts perform the same bcrypt work as real ones.
const DUMMY_PASSWORD_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'

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
  if (email.length > 320 || password.length > 4096) return { error: 'Invalid email or password.' }
  if (!(await consumeAuthAttempt(await headers(), `login:${normalizedEmail}`))) {
    return { error: 'Too many authentication attempts. Please try again shortly.' }
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  const user = userRows[0]
  let passwordValid: boolean
  try {
    passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
  } catch (error) {
    if (error instanceof PasswordWorkBusyError) return { error: error.message }
    throw error
  }

  if (!user || !passwordValid) {
    return { error: 'Invalid email or password.' }
  }

  const { token, expiresAt } = await createSession(user.id, user.passwordHash)
  const cookieStore = await cookies()
  cookieStore.set(getSessionCookieConfig(token, expiresAt))

  const next = formData.get('next')
  redirect(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
}

export async function registerAction(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email')
  const password = formData.get('password')
  const name = formData.get('name')

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof name !== 'string' ||
    !email ||
    !password ||
    !name
  ) {
    return { error: 'Name, email, and password are required.' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const trimmedName = name.trim()
  if (email.length > 320 || name.length > 200) return { error: 'Name or email is too long.' }
  if (!(await consumeAuthAttempt(await headers(), `register:${normalizedEmail}`))) {
    return { error: 'Too many authentication attempts. Please try again shortly.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (Buffer.byteLength(password, 'utf8') > 72) return { error: 'Password must not exceed 72 UTF-8 bytes.' }

  // Hash before the existence check to avoid a fast existing-account path.
  let passwordHash: string
  try {
    passwordHash = await hashPassword(password)
  } catch (error) {
    if (error instanceof PasswordWorkBusyError) return { error: error.message }
    throw error
  }

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existingUsers.length > 0) {
    return { error: 'An account with this email already exists.' }
  }

  const [newUser] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: trimmedName, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id })
  if (!newUser) return { error: 'An account with this email already exists.' }

  const { token, expiresAt } = await createSession(newUser.id, passwordHash)
  const cookieStore = await cookies()
  cookieStore.set(getSessionCookieConfig(token, expiresAt))

  const next = formData.get('next')
  redirect(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
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

export async function logoutAction(formData?: FormData): Promise<void> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (sessionCookie?.value) await deleteSession(sessionCookie.value)
  cookieStore.delete(SESSION_COOKIE_NAME)
  const requestedNext = formData?.get('next')
  const next = typeof requestedNext === 'string' && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : null
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
}
