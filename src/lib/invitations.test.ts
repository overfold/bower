import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'
const invitationsModule = import('./invitations')

test('invitation status distinguishes the last available use from exhaustion and unlimited reuse', async () => {
  const { invitationStatus } = await invitationsModule
  const invitation = { reusable: true, usedAt: new Date(), expiresAt: null, revokedAt: null, maxUses: 3, useCount: 2 }
  assert.equal(invitationStatus(invitation), 'active')
  assert.equal(invitationStatus({ ...invitation, useCount: 3 }), 'used')
  assert.equal(invitationStatus({ ...invitation, maxUses: null, useCount: 100 }), 'active')
  assert.equal(invitationStatus({ ...invitation, reusable: false, useCount: 0 }), 'used')
  assert.equal(invitationStatus({ ...invitation, expiresAt: new Date(0) }), 'expired')
  assert.equal(invitationStatus({ ...invitation, revokedAt: new Date() }), 'revoked')
})

test('acceptance enforces use limits under concurrency and rolls back failed grants', { skip: !process.env.BOWER_TEST_DATABASE_URL }, async () => {
  const { db } = await import('../db')
  const { invitations, users } = await import('../db/schema')
  const { acceptInvitation, createInvitationToken, hashInvitationToken } = await invitationsModule
  const userIds: string[] = []
  const invitationIds: string[] = []
  try {
    for (let index = 0; index < 8; index++) {
      const [user] = await db.insert(users).values({ email: `${randomUUID()}@invitation-test.invalid`, name: 'Invitation test', passwordHash: 'unused' }).returning()
      userIds.push(user.id)
    }
    for (const limit of [1, 3, null]) {
      const token = createInvitationToken()
      const [invitation] = await db.insert(invitations).values({ tokenHash: hashInvitationToken(token), reusable: limit !== 1, maxUses: limit }).returning()
      invitationIds.push(invitation.id)
      const results = await Promise.all(userIds.map((id) => acceptInvitation(token, id)))
      assert.equal(results.filter((result) => !result.error).length, limit ?? 8)
      const [stored] = await db.select().from(invitations).where(eq(invitations.id, invitation.id))
      assert.equal(stored.useCount, limit ?? 8)
      assert.ok(stored.usedAt)
    }
    const token = createInvitationToken()
    const [invitation] = await db.insert(invitations).values({ tokenHash: hashInvitationToken(token) }).returning()
    invitationIds.push(invitation.id)
    await assert.rejects(acceptInvitation(token, randomUUID()))
    const [stored] = await db.select().from(invitations).where(eq(invitations.id, invitation.id))
    assert.equal(stored.useCount, 0)
    assert.equal(stored.usedAt, null)
    assert.equal((await acceptInvitation(token, userIds[0])).error, undefined)
  } finally {
    if (invitationIds.length) await db.delete(invitations).where(inArray(invitations.id, invitationIds))
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds))
  }
})

after(async () => {
  const { db } = await import('../db')
  await db.$client.end()
})
