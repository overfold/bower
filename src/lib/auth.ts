import { hash, compare } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, sessions } from '@/db/schema'
import type { User, Session } from '@/types/auth'
import { acquirePasswordWork, PasswordWorkBusyError } from '@/lib/auth-abuse'

export { PasswordWorkBusyError }

const BCRYPT_ROUNDS = 12
const SESSION_COOKIE_NAME = 'bower_session'
const SESSION_DURATION_DAYS = 30

export async function hashPassword(password: string): Promise<string> {
  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('Password must not exceed 72 UTF-8 bytes.')
  const release = await acquirePasswordWork()
  if (!release) throw new PasswordWorkBusyError()
  try { return await hash(password, BCRYPT_ROUNDS) } finally { await release() }
}

export async function verifyPassword(
  password: string,
  hashValue: string
): Promise<boolean> {
  if (password.length > 4096) return false
  const release = await acquirePasswordWork()
  if (!release) throw new PasswordWorkBusyError()
  try { return await compare(password, hashValue) } finally { await release() }
}

export function generateSessionToken(): string {
  return randomUUID()
}

export async function createSession(
  userId: string,
  expectedPasswordHash?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  )

  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
    if (!user || (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)) {
      throw new Error('Credentials changed. Please sign in again.')
    }
    await tx.insert(sessions).values({ userId, token, expiresAt })
  })

  return { token, expiresAt }
}

export async function replacePasswordAndSessions(userId: string, expectedHash: string, passwordHash: string) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)
  const revoked = await db.transaction(async (tx) => {
    const updated = await tx.update(users).set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.passwordHash, expectedHash))).returning({ id: users.id })
    if (!updated.length) return null
    const oldSessions = await tx.delete(sessions).where(eq(sessions.userId, userId)).returning({ token: sessions.token })
    await tx.insert(sessions).values({ userId, token, expiresAt })
    return oldSessions
  })
  if (!revoked) return null
  await Promise.all(revoked.map((session) => revokeExecSession(session.token)))
  return { token, expiresAt }
}

export async function validateSession(
  token: string
): Promise<{ user: User; session: Session } | null> {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1)

  if (sessionRows.length === 0) {
    return null
  }

  const sessionRow = sessionRows[0]
  const now = new Date()

  if (new Date(sessionRow.expiresAt) <= now) {
    await db.delete(sessions).where(eq(sessions.token, token))
    return null
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionRow.userId))
    .limit(1)

  if (userRows.length === 0) {
    await db.delete(sessions).where(eq(sessions.token, token))
    return null
  }

  const userRow = userRows[0]

  const user: User = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    avatarUrl: userRow.avatarUrl,
    isInstanceAdmin: userRow.isInstanceAdmin,
    createdAt: new Date(userRow.createdAt),
  }

  const session: Session = {
    id: sessionRow.id,
    userId: sessionRow.userId,
    token: sessionRow.token,
    expiresAt: new Date(sessionRow.expiresAt),
    createdAt: new Date(sessionRow.createdAt),
  }

  return { user, session }
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token))
  await revokeExecSession(token)
}

async function revokeExecSession(token: string): Promise<void> {
  // Immediately tear down terminals in this instance, including other tabs.
  // Other instances also check persisted session validity every 15 seconds.
  if (process.env.BOWER_EXEC_BRIDGE_URL && process.env.BOWER_EXEC_INTERNAL_SECRET) {
    await fetch(`${process.env.BOWER_EXEC_BRIDGE_URL}/_bower/exec/revoke`, {
      method: 'POST', headers: { 'x-bower-exec-secret': process.env.BOWER_EXEC_INTERNAL_SECRET },
      body: token, signal: AbortSignal.timeout(2000),
    }).catch(() => undefined)
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) {
    return null
  }

  const result = await validateSession(sessionCookie.value)
  return result?.user ?? null
}

export function getSessionCookieConfig(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  }
}

export { SESSION_COOKIE_NAME }
