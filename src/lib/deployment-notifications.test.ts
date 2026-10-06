import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { notificationsButtonLabel, seenThrough, unreadBadgeText } from './notification-feed'
import { statusDefinition } from './status'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'
const notificationsModule = import('./deployment-notifications')
const databaseTest = { skip: !process.env.BOWER_TEST_DATABASE_URL }

test('notification statuses come from the shared status vocabulary and exclude in-progress deployments', async () => {
  const { FAILED_DEPLOYMENT_STATUSES, SUCCEEDED_DEPLOYMENT_STATUSES } = await notificationsModule
  // An automatic rollback means the rollout failed, so it is in the failure audience.
  assert.deepEqual(FAILED_DEPLOYMENT_STATUSES, ['failed', 'rolled_back'])
  assert.deepEqual(SUCCEEDED_DEPLOYMENT_STATUSES, ['healthy'])
  for (const status of [...FAILED_DEPLOYMENT_STATUSES, ...SUCCEEDED_DEPLOYMENT_STATUSES]) {
    assert.equal(statusDefinition(status)?.inProgress ?? false, false, status)
  }
  for (const status of ['pending', 'planning', 'deploying']) {
    assert.ok(![...FAILED_DEPLOYMENT_STATUSES, ...SUCCEEDED_DEPLOYMENT_STATUSES].includes(status as never), status)
  }
})

test('the unread badge caps at 9+ while the accessible name keeps the exact count', () => {
  assert.equal(unreadBadgeText(0), null)
  assert.equal(unreadBadgeText(3), '3')
  assert.equal(unreadBadgeText(9), '9')
  assert.equal(unreadBadgeText(10), '9+')
  assert.equal(notificationsButtonLabel(0), 'Notifications')
  assert.equal(notificationsButtonLabel(3), 'Notifications, 3 unread')
  assert.equal(notificationsButtonLabel(42), 'Notifications, 42 unread')
})

test('opening the menu marks items read only up to the newest one it loaded', () => {
  assert.equal(seenThrough([]), null)
  assert.equal(seenThrough([
    { occurredAt: '2026-10-01T10:00:00.000Z' },
    { occurredAt: '2026-10-03T09:30:00.000Z' },
    { occurredAt: '2026-10-02T12:00:00.000Z' },
  ]), '2026-10-03T09:30:00.000Z')
})

async function seedFixture() {
  const { db } = await import('../db')
  const schema = await import('../db/schema')
  const suffix = randomUUID().slice(0, 8)
  const [me, other] = await db.insert(schema.users).values([
    { email: `me-${suffix}@notifications-test.invalid`, name: 'Me', passwordHash: 'unused' },
    { email: `other-${suffix}@notifications-test.invalid`, name: 'Other', passwordHash: 'unused' },
  ]).returning()
  const [org, otherOrg] = await db.insert(schema.organizations).values([
    { name: 'Notifications', slug: `notifications-${suffix}`, trellisApiUrl: 'http://trellis.invalid', trellisApiToken: 'unused' },
    { name: 'Elsewhere', slug: `elsewhere-${suffix}`, trellisApiUrl: 'http://trellis.invalid', trellisApiToken: 'unused' },
  ]).returning()
  await db.insert(schema.organizationMembers).values([
    { orgId: org.id, userId: me.id, role: 'member' },
    { orgId: org.id, userId: other.id, role: 'admin' },
    { orgId: otherOrg.id, userId: me.id, role: 'owner' },
  ])
  const [granted, hidden, foreign] = await db.insert(schema.projects).values([
    { orgId: org.id, name: 'Granted', slug: 'granted' },
    { orgId: org.id, name: 'Hidden', slug: 'hidden' },
    { orgId: otherOrg.id, name: 'Foreign', slug: 'foreign' },
  ]).returning()
  // The member can reach "Granted" through a team and nothing else in this organization.
  const [team] = await db.insert(schema.teams).values({ orgId: org.id, name: 'Team' }).returning()
  await db.insert(schema.teamMemberships).values({ teamId: team.id, userId: me.id })
  await db.insert(schema.teamProjectAccess).values({ teamId: team.id, projectId: granted.id, role: 'deployer' })

  const serviceFor: Record<string, { serviceId: string; environmentId: string }> = {}
  for (const project of [granted, hidden, foreign]) {
    const [environment] = await db.insert(schema.environments).values({ projectId: project.id, name: 'Production', slug: 'production', trellisNamespace: `ns-${project.slug}-${suffix}` }).returning()
    const [service] = await db.insert(schema.services).values({ projectId: project.id, name: `${project.name} web`, slug: 'web' }).returning()
    serviceFor[project.slug] = { serviceId: service.id, environmentId: environment.id }
  }
  return { db, schema, me, other, org, otherOrg, serviceFor }
}

type Fixture = Awaited<ReturnType<typeof seedFixture>>

async function cleanup(fixture: Fixture) {
  const { db, schema } = fixture
  await db.delete(schema.organizations).where(inArray(schema.organizations.id, [fixture.org.id, fixture.otherOrg.id]))
  await db.delete(schema.users).where(inArray(schema.users.id, [fixture.me.id, fixture.other.id]))
}

async function deploy(fixture: Fixture, input: { project: string; status: 'pending' | 'planning' | 'deploying' | 'healthy' | 'failed' | 'rolled_back'; by: string | null; at: Date; completed?: boolean }) {
  const target = fixture.serviceFor[input.project]
  const [row] = await fixture.db.insert(fixture.schema.deployments).values({
    ...target, imageAfter: 'registry.invalid/web:1', strategy: 'rolling', triggerType: 'manual',
    status: input.status, triggeredByUserId: input.by, createdAt: input.at, startedAt: input.at,
    completedAt: input.completed === false ? null : input.at,
  }).returning()
  return row.id
}

test('the feed is limited to accessible projects, failures, and the user\'s own outcomes, and counts unread after last seen', databaseTest, async () => {
  const { loadNotificationFeed, markNotificationsSeen } = await notificationsModule
  const fixture = await seedFixture()
  const { me, other, org } = fixture
  try {
    const firstVisit = new Date('2026-10-04T08:00:00.000Z')
    const first = await loadNotificationFeed({ userId: me.id, orgId: org.id, orgRole: 'member', now: firstVisit })
    assert.deepEqual(first, { items: [], unreadCount: 0, lastSeenAt: firstVisit.toISOString() })

    const minutes = (n: number) => new Date(firstVisit.getTime() + n * 60_000)
    const seenBefore = await deploy(fixture, { project: 'granted', status: 'failed', by: other.id, at: minutes(-30) })
    const othersFailure = await deploy(fixture, { project: 'granted', status: 'failed', by: other.id, at: minutes(5) })
    const myFailure = await deploy(fixture, { project: 'granted', status: 'failed', by: me.id, at: minutes(6) })
    const mySuccess = await deploy(fixture, { project: 'granted', status: 'healthy', by: me.id, at: minutes(7) })
    // An automatic rollback is a failed rollout: it notifies like a failure.
    const rolledBack = await deploy(fixture, { project: 'granted', status: 'rolled_back', by: other.id, at: minutes(9) })
    // None of these may appear, or be counted.
    await deploy(fixture, { project: 'granted', status: 'healthy', by: other.id, at: minutes(8) })
    await deploy(fixture, { project: 'granted', status: 'healthy', by: null, at: minutes(8) })
    await deploy(fixture, { project: 'granted', status: 'deploying', by: me.id, at: minutes(9), completed: false })
    await deploy(fixture, { project: 'granted', status: 'pending', by: me.id, at: minutes(9), completed: false })
    await deploy(fixture, { project: 'granted', status: 'failed', by: other.id, at: new Date(firstVisit.getTime() - 15 * 24 * 60 * 60_000) })
    await deploy(fixture, { project: 'hidden', status: 'failed', by: other.id, at: minutes(10) })
    await deploy(fixture, { project: 'hidden', status: 'healthy', by: me.id, at: minutes(10) })
    await deploy(fixture, { project: 'foreign', status: 'failed', by: me.id, at: minutes(10) })

    const now = minutes(20)
    const feed = await loadNotificationFeed({ userId: me.id, orgId: org.id, orgRole: 'member', now })
    assert.deepEqual(feed.items.map((item) => item.id), [rolledBack, mySuccess, myFailure, othersFailure, seenBefore])
    assert.deepEqual(feed.items.map((item) => item.unread), [true, true, true, true, false])
    assert.equal(feed.unreadCount, 4)
    assert.ok(feed.items.every((item) => item.projectSlug === 'granted'))
    assert.deepEqual(feed.items.map((item) => item.kind === 'deployment' && item.triggeredByMe), [false, true, true, false, false])
    assert.equal(feed.items[0].environmentName, 'Production')

    // An admin in the same organization sees failures in every project there, but not another organization's.
    const adminFeed = await loadNotificationFeed({ userId: other.id, orgId: org.id, orgRole: 'admin', now })
    assert.ok(adminFeed.items.some((item) => item.projectSlug === 'hidden'))
    assert.ok(adminFeed.items.every((item) => item.projectSlug !== 'foreign'))
    assert.ok(!adminFeed.items.some((item) => item.id === mySuccess), 'another user\'s success is not shown')

    // The limit bounds the list but not the unread count.
    const limited = await loadNotificationFeed({ userId: me.id, orgId: org.id, orgRole: 'member', now, limit: 1 })
    assert.deepEqual(limited.items.map((item) => item.id), [rolledBack])
    assert.equal(limited.unreadCount, 4)

    await markNotificationsSeen(me.id, org.id, minutes(6), now)
    const partlyRead = await loadNotificationFeed({ userId: me.id, orgId: org.id, orgRole: 'member', now })
    assert.equal(partlyRead.unreadCount, 2)
    assert.deepEqual(partlyRead.items.filter((item) => item.unread).map((item) => item.id), [rolledBack, mySuccess])
  } finally {
    await cleanup(fixture)
  }
})

test('a member with no project access sees nothing, including in the count', databaseTest, async () => {
  const { loadNotificationFeed } = await notificationsModule
  const fixture = await seedFixture()
  try {
    const { other, org } = fixture
    const now = new Date('2026-10-04T08:00:00.000Z')
    await loadNotificationFeed({ userId: other.id, orgId: org.id, orgRole: 'member', now })
    await deploy(fixture, { project: 'granted', status: 'failed', by: other.id, at: new Date(now.getTime() + 60_000) })
    await deploy(fixture, { project: 'hidden', status: 'failed', by: other.id, at: new Date(now.getTime() + 60_000) })
    // Their own deployment is hidden too once they can't access its project.
    await deploy(fixture, { project: 'hidden', status: 'healthy', by: other.id, at: new Date(now.getTime() + 60_000) })
    const feed = await loadNotificationFeed({ userId: other.id, orgId: org.id, orgRole: 'member', now: new Date(now.getTime() + 120_000) })
    assert.deepEqual(feed.items, [])
    assert.equal(feed.unreadCount, 0)
  } finally {
    await cleanup(fixture)
  }
})

test('the read marker is per organization, never moves backward, and is capped at the current time', databaseTest, async () => {
  const { getLastSeenAt, markNotificationsSeen } = await notificationsModule
  const fixture = await seedFixture()
  const { me, org, otherOrg } = fixture
  try {
    const now = new Date('2026-10-04T08:00:00.000Z')
    assert.equal((await getLastSeenAt(me.id, org.id, now)).toISOString(), now.toISOString())
    assert.equal((await getLastSeenAt(me.id, org.id, new Date(now.getTime() + 60_000))).toISOString(), now.toISOString(), 'the first visit is recorded once')

    const later = new Date(now.getTime() + 10 * 60_000)
    assert.equal((await markNotificationsSeen(me.id, org.id, later, later)).toISOString(), later.toISOString())
    assert.equal((await markNotificationsSeen(me.id, org.id, now, later)).toISOString(), later.toISOString(), 'never moves backward')
    const future = new Date(later.getTime() + 24 * 60 * 60_000)
    const capped = new Date(later.getTime() + 60_000)
    assert.equal((await markNotificationsSeen(me.id, org.id, future, capped)).toISOString(), capped.toISOString(), 'capped at now')

    const elsewhere = new Date(now.getTime() + 5 * 60_000)
    assert.equal((await getLastSeenAt(me.id, otherOrg.id, elsewhere)).toISOString(), elsewhere.toISOString(), 'other organizations keep their own marker')
    assert.equal((await getLastSeenAt(me.id, org.id, elsewhere)).toISOString(), capped.toISOString())
  } finally {
    await cleanup(fixture)
  }
})

after(async () => {
  if (!process.env.BOWER_TEST_DATABASE_URL) return
  const { db } = await import('../db')
  await db.$client.end()
})
