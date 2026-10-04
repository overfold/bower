import { createHash, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { and, eq, gt, like, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { authAbuseBuckets } from '@/db/schema'

type HeadersLike = { get(name: string): string | null }
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

// Enable only behind an ingress that strips and overwrites this header and
// prevents direct access to Bower. Forwarded headers are untrusted by default.
export function authSource(headers: HeadersLike): string {
  const header = process.env.BOWER_AUTH_SOURCE_HEADER
  const value = header ? headers.get(header)?.trim() : null
  return value && isIP(value) ? value : 'unknown'
}

// Fixed one-minute windows. Check broad limits first so rejected traffic cannot
// create unbounded rows. Changing route IDs cannot bypass source/family limits.
export async function consumeAuthAttempt(headers: HeadersLike, scope: string): Promise<boolean> {
  const family = scope.split(':')[0]
  const source = digest(authSource(headers))
  const dimensions: [string, number][] = [
    ['attempt:global', 300],
    [`attempt:family:${digest(family)}`, 150],
    [`attempt:source:${source}`, 30],
    [`attempt:source-scope:${source}:${digest(scope)}`, 10],
    [`attempt:scope:${digest(scope)}`, 50],
  ]
  return db.transaction(async (tx) => {
    // Serialize admission and cleanup across app replicas, not just processes.
    await tx.execute(sql`select pg_advisory_xact_lock(19483721)`)
    const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`)
    const now = new Date(clock.now)
    const expiresAt = new Date(now.getTime() + 60_000)
    await tx.delete(authAbuseBuckets).where(lte(authAbuseBuckets.expiresAt, now))
    for (const [key, limit] of dimensions) {
      const [row] = await tx.insert(authAbuseBuckets).values({ key, count: 1, expiresAt })
        .onConflictDoUpdate({ target: authAbuseBuckets.key, set: { count: sql`least(${authAbuseBuckets.count} + 1, 1000000)` } })
        .returning({ count: authAbuseBuckets.count })
      if (row.count > limit) return false
    }
    return true
  })
}

// Nonqueued, shared four-slot lease. Expiration recovers slots after process
// death; normal bcrypt work must finish within the two-minute lease lifetime.
export async function acquirePasswordWork(): Promise<(() => Promise<void>) | null> {
  const key = `password-work:${randomUUID()}`
  const acquired = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(19483721)`)
    const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`)
    const now = new Date(clock.now)
    await tx.delete(authAbuseBuckets).where(lte(authAbuseBuckets.expiresAt, now))
    const leases = await tx.select({ key: authAbuseBuckets.key }).from(authAbuseBuckets)
      .where(and(like(authAbuseBuckets.key, 'password-work:%'), gt(authAbuseBuckets.expiresAt, now)))
    if (leases.length >= 4) return false
    await tx.insert(authAbuseBuckets).values({ key, expiresAt: new Date(now.getTime() + 120_000) })
    return true
  })
  return acquired ? async () => { await db.delete(authAbuseBuckets).where(eq(authAbuseBuckets.key, key)) } : null
}

export class PasswordWorkBusyError extends Error {
  constructor() { super('Too many authentication attempts. Please try again shortly.') }
}
