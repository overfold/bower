import 'next/dist/server/node-environment-baseline'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store'
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'
import { createWorkStore } from 'next/dist/server/async-storage/work-store'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'
const enabled = Boolean(process.env.BOWER_TEST_DATABASE_URL)

function requestStore(token?: string) {
  const request = new NextRequest('https://bower.test/settings/organization', {
    headers: token ? { cookie: `bower_session=${token}` } : {},
  })
  return createRequestStoreForAPI(request, { pathname: '/settings/organization' },
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined)
}

function runRequest<T>(store: ReturnType<typeof requestStore>, action: () => T): T {
  const work = createWorkStore({ page: '/settings/organization/page', buildId: 'test', deploymentId: '', previouslyRevalidatedTags: [],
    renderOpts: { cacheLifeProfiles: { default: { stale: 300, revalidate: 900, expire: 3600 } }, staticPageGenerationTimeout: 60, cacheComponents: false, validationLevel: 'warning', supportsDynamicResponse: true,
      waitUntil: undefined, onClose: () => {}, onAfterTaskError: undefined,
      experimental: { isRoutePPREnabled: false, authInterrupts: false, useCacheTimeout: 60 } } })
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, action))
}

test('source identity ignores forwarded headers unless trusted ingress is explicitly configured', async () => {
  const { authSource } = await import('./auth-abuse')
  const previous = process.env.BOWER_AUTH_SOURCE_HEADER
  try {
    delete process.env.BOWER_AUTH_SOURCE_HEADER
    assert.equal(authSource(new Headers({ 'x-forwarded-for': '192.0.2.1', 'x-real-ip': '192.0.2.2' })), 'unknown')
    process.env.BOWER_AUTH_SOURCE_HEADER = 'x-trusted-source'
    assert.equal(authSource(new Headers({ 'x-trusted-source': '192.0.2.3' })), '192.0.2.3')
    assert.equal(authSource(new Headers({ 'x-trusted-source': '192.0.2.3, 192.0.2.4' })), 'unknown')
    assert.equal(authSource(new Headers({ 'x-trusted-source': 'not-an-ip' })), 'unknown')
  } finally {
    if (previous === undefined) delete process.env.BOWER_AUTH_SOURCE_HEADER
    else process.env.BOWER_AUTH_SOURCE_HEADER = previous
  }
})

test('shared admission limits changing scopes, concurrent bcrypt work, and expires stale state', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { authAbuseBuckets } = await import('../db/schema')
  const { consumeAuthAttempt, acquirePasswordWork } = await import('./auth-abuse')
  const { hashPassword, verifyPassword, PasswordWorkBusyError } = await import('./auth')
  // This test requires a dedicated disposable test database: counters are global.
  await db.delete(authAbuseBuckets)
  const previousSourceHeader = process.env.BOWER_AUTH_SOURCE_HEADER
  try {
    const headers = new Headers()
    const attempts = await Promise.all(Array.from({ length: 11 }, () => consumeAuthAttempt(headers, 'login:one')))
    assert.equal(attempts.filter(Boolean).length, 10)
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 30; index++) assert.equal(await consumeAuthAttempt(headers, `route-password:${index}`), true)
    assert.equal(await consumeAuthAttempt(headers, 'route-password:different'), false)
    await db.update(authAbuseBuckets).set({ expiresAt: new Date(0) })
    assert.equal(await consumeAuthAttempt(headers, 'route-password:different'), true)

    process.env.BOWER_AUTH_SOURCE_HEADER = 'x-trusted-source'
    const source = (index: number) => new Headers({ 'x-trusted-source': `198.51.100.${index % 256}` })
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 50; index++) assert.equal(await consumeAuthAttempt(source(index), 'route-password:shared'), true)
    assert.equal(await consumeAuthAttempt(source(50), 'route-password:shared'), false, 'route-wide limit must bound distributed sources')
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 150; index++) assert.equal(await consumeAuthAttempt(source(index), `route-password:${index}`), true)
    assert.equal(await consumeAuthAttempt(source(150), 'route-password:another'), false, 'family limit must bound changing routes and sources')
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 300; index++) assert.equal(await consumeAuthAttempt(source(index), `${['login', 'register', 'route-password'][index % 3]}:${index}`), true)
    assert.equal(await consumeAuthAttempt(source(301), 'login:another'), false, 'global limit must bound changing authentication families')
    const bucketCount = (await db.select().from(authAbuseBuckets)).length
    for (let index = 0; index < 20; index++) assert.equal(await consumeAuthAttempt(source(index), `register:rejected-${index}`), false)
    assert.equal((await db.select().from(authAbuseBuckets)).length, bucketCount, 'rejected global attempts must not create new scope rows')

    const releases = await Promise.all(Array.from({ length: 8 }, () => acquirePasswordWork()))
    assert.equal(releases.filter(Boolean).length, 4)
    await assert.rejects(hashPassword('valid-password'), PasswordWorkBusyError)
    await Promise.all(releases.map((release) => release?.()))
    const hash = await hashPassword('é'.repeat(36))
    assert.equal(await verifyPassword('é'.repeat(36), hash), true)
    assert.equal(await verifyPassword('wrong-password', hash), false)
    await assert.rejects(hashPassword('é'.repeat(37)), /72 UTF-8 bytes/)
    assert.equal((await db.select().from(authAbuseBuckets)).some((row) => row.key.startsWith('password-work:')), false)
  } finally {
    await db.delete(authAbuseBuckets)
    if (previousSourceHeader === undefined) delete process.env.BOWER_AUTH_SOURCE_HEADER
    else process.env.BOWER_AUTH_SOURCE_HEADER = previousSourceHeader
  }
})

test('API keys require current membership and canonical direct/team roles; offboarding preserves other orgs', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, organizations, organizationMembers, projects, services, teams, teamMemberships, teamProjectAccess, projectUserAccess, apiKeys } = await import('../db/schema')
  const { authenticateApiKey } = await import('./api-auth')
  const { revokeOrganizationMembership } = await import('./organization-members')
  const [user] = await db.insert(users).values({ name: 'Security test', email: `${randomUUID()}@security.invalid`, passwordHash: 'unused' }).returning()
  const orgIds: string[] = []
  try {
    const fixtures = []
    for (let index = 0; index < 2; index++) {
      const [org] = await db.insert(organizations).values({ name: 'Security test', slug: randomUUID(), trellisApiUrl: '', trellisApiToken: '' }).returning()
      orgIds.push(org.id)
      const [membership] = await db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: 'member' }).returning()
      const [project] = await db.insert(projects).values({ orgId: org.id, name: 'Test', slug: 'test' }).returning()
      const [service] = await db.insert(services).values({ projectId: project.id, name: 'Test', slug: 'test' }).returning()
      const [team] = await db.insert(teams).values({ orgId: org.id, name: 'Test' }).returning()
      await db.insert(teamMemberships).values({ teamId: team.id, userId: user.id })
      await db.insert(teamProjectAccess).values({ teamId: team.id, projectId: project.id, role: 'deployer' })
      await db.insert(projectUserAccess).values({ projectId: project.id, userId: user.id, role: 'viewer' })
      const token = randomUUID()
      await db.insert(apiKeys).values({ orgId: org.id, userId: user.id, name: 'Test', keyPrefix: 'test', keyHash: createHash('sha256').update(token).digest('hex') })
      fixtures.push({ membership, project, service, team, token })
    }
    const [target, unrelated] = fixtures
    const authenticate = () => authenticateApiKey(`Bearer ${target.token}`, target.service.id)
    assert.ok(await authenticate())
    await db.delete(organizationMembers).where(eq(organizationMembers.id, target.membership.id))
    assert.equal(await authenticate(), null, 'surviving team grant must not authorize a removed member')
    await db.insert(organizationMembers).values(target.membership)
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, target.team.id))
    assert.equal(await authenticate(), null, 'viewer direct grant is not deploy access')
    await db.update(projectUserAccess).set({ role: 'deployer' }).where(eq(projectUserAccess.projectId, target.project.id))
    assert.ok(await authenticate(), 'direct deployer grants must work')
    await db.delete(projectUserAccess).where(eq(projectUserAccess.projectId, target.project.id))
    assert.equal(await authenticate(), null, 'removed direct grant must take effect')
    await db.update(users).set({ isInstanceAdmin: true }).where(eq(users.id, user.id))
    assert.equal(await authenticate(), null, 'explicit member role remains authoritative for instance admins')
    await db.delete(organizationMembers).where(eq(organizationMembers.id, target.membership.id))
    assert.ok(await authenticate(), 'instance admins deliberately receive synthetic owner access without membership')
    await db.update(users).set({ isInstanceAdmin: false }).where(eq(users.id, user.id))
    await db.insert(organizationMembers).values(target.membership)
    await db.insert(projectUserAccess).values({ projectId: target.project.id, userId: user.id, role: 'admin' })
    await db.insert(teamMemberships).values({ teamId: target.team.id, userId: user.id })
    await revokeOrganizationMembership(target.membership)
    assert.equal(await authenticate(), null)
    assert.equal((await db.select().from(apiKeys).where(eq(apiKeys.orgId, orgIds[0]))).length, 0)
    assert.equal((await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, target.team.id))).length, 0)
    assert.equal((await db.select().from(projectUserAccess).where(eq(projectUserAccess.projectId, target.project.id))).length, 0)
    assert.ok(await authenticateApiKey(`Bearer ${unrelated.token}`, unrelated.service.id))
    assert.equal((await db.select().from(projectUserAccess).where(eq(projectUserAccess.projectId, unrelated.project.id))).length, 1)
    assert.equal((await db.select().from(organizationMembers).where(eq(organizationMembers.id, unrelated.membership.id))).length, 1)
    assert.equal((await db.select().from(teamProjectAccess).where(eq(teamProjectAccess.teamId, target.team.id))).length, 1, 'team-wide grants must remain for other members')
  } finally {
    await db.delete(organizations).where(inArray(organizations.id, orgIds))
    await db.delete(users).where(eq(users.id, user.id))
  }
})

test('password replacement revokes all old sessions, rotates current session, and rejects stale login races', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users } = await import('../db/schema')
  const { createSession, validateSession, replacePasswordAndSessions } = await import('./auth')
  const [user] = await db.insert(users).values({ name: 'Session test', email: `${randomUUID()}@security.invalid`, passwordHash: 'old-hash' }).returning()
  try {
    const current = await createSession(user.id, 'old-hash')
    const stolen = await createSession(user.id, 'old-hash')
    assert.ok(await validateSession(stolen.token))
    assert.equal(await replacePasswordAndSessions(user.id, 'wrong-hash', 'new-hash'), null)
    assert.ok(await validateSession(current.token))
    const replacement = await replacePasswordAndSessions(user.id, 'old-hash', 'new-hash')
    assert.ok(replacement)
    assert.notEqual(replacement.token, current.token)
    assert.equal(await validateSession(current.token), null)
    assert.equal(await validateSession(stolen.token), null)
    assert.equal((await validateSession(replacement.token))?.user.id, user.id)
    await assert.rejects(createSession(user.id, 'old-hash'), /Credentials changed/)
  } finally { await db.delete(users).where(eq(users.id, user.id)) }
})

test('organization client props never contain durable tokens; password action verifies, rotates, and audits', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, organizations, organizationMembers, auditLog } = await import('../db/schema')
  const { hashPassword, createSession, validateSession } = await import('./auth')
  const { updateOrganizationAction, changePasswordAction } = await import('./actions/settings')
  const { default: OrganizationPage } = await import('../app/(dashboard)/settings/organization/page')
  const { ClusterSettingsForm } = await import('../components/cluster-settings-form')
  const passwordHash = await hashPassword('Current-password-123')
  const [user] = await db.insert(users).values({ name: 'Action test', email: `${randomUUID()}@security.invalid`, passwordHash }).returning()
  const durableToken = `synthetic-durable-${randomUUID()}`
  const [org] = await db.insert(organizations).values({ name: 'Test', slug: randomUUID(), trellisApiUrl: 'https://cluster.invalid', trellisApiToken: durableToken }).returning()
  const [membership] = await db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: 'member' }).returning()
  const session = await createSession(user.id)
  const stale = await createSession(user.id)
  try {
    const store = requestStore(session.token)
    const memberPage = await runRequest(store, OrganizationPage)
    assert.equal(JSON.stringify(memberPage).includes(durableToken), false)
    assert.equal(memberPage.props.children[2], false)
    const replacementForm = new FormData()
    replacementForm.set('trellisApiToken', 'replacement-token')
    assert.equal((await runRequest(store, () => updateOrganizationAction(replacementForm))).error, 'Insufficient permissions.')
    await db.update(organizationMembers).set({ role: 'admin' }).where(eq(organizationMembers.id, membership.id))
    const adminPage = await runRequest(store, OrganizationPage)
    assert.equal(JSON.stringify(adminPage).includes(durableToken), false)
    const clientElement = adminPage.props.children[2].props.children
    assert.equal(clientElement.type, ClusterSettingsForm)
    assert.deepEqual(clientElement.props.org, { trellisApiUrl: 'https://cluster.invalid', tokenConfigured: true, workloadIdentity: false })
    const blank = new FormData()
    blank.set('trellisApiToken', '')
    assert.equal((await runRequest(store, () => updateOrganizationAction(blank))).success, true)
    assert.equal((await db.select().from(organizations).where(eq(organizations.id, org.id)))[0].trellisApiToken, durableToken)
    const passwordForm = new FormData()
    passwordForm.set('currentPassword', 'incorrect')
    passwordForm.set('newPassword', 'Replacement-password-456')
    assert.ok((await runRequest(store, () => changePasswordAction(passwordForm))).fieldErrors?.currentPassword)
    assert.ok(await validateSession(stale.token))
    passwordForm.set('currentPassword', 'Current-password-123')
    assert.equal((await runRequest(store, () => changePasswordAction(passwordForm))).success, true)
    const rotatedToken = store.userspaceMutableCookies.get('bower_session')?.value
    assert.ok(rotatedToken)
    assert.notEqual(rotatedToken, session.token)
    assert.equal(await validateSession(stale.token), null)
    assert.equal(await validateSession(session.token), null)
    assert.ok(await validateSession(rotatedToken))
    assert.equal((await db.select().from(auditLog).where(eq(auditLog.action, 'account.password.changed'))).filter((row) => row.userId === user.id).length, 1)
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id))
    await db.delete(users).where(eq(users.id, user.id))
  }
})

test('login and registration share throttling and public signup still creates an authenticated session', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, authAbuseBuckets } = await import('../db/schema')
  const { loginAction, registerAction } = await import('./auth-actions')
  const { validateSession } = await import('./auth')
  const email = `${randomUUID()}@security.invalid`
  const form = new FormData()
  form.set('email', email)
  form.set('password', 'Signup-password-123')
  form.set('name', 'Public signup')
  await db.delete(authAbuseBuckets)
  try {
    const store = requestStore()
    await assert.rejects(runRequest(store, () => registerAction(form)), /NEXT_REDIRECT/)
    const token = store.userspaceMutableCookies.get('bower_session')?.value
    assert.ok(token)
    assert.equal((await validateSession(token))?.user.email, email)
    form.set('password', 'incorrect-password')
    assert.deepEqual(await runRequest(requestStore(), () => loginAction(form)), { error: 'Invalid email or password.' })
    form.set('email', `${randomUUID()}@security.invalid`)
    assert.deepEqual(await runRequest(requestStore(), () => loginAction(form)), { error: 'Invalid email or password.' })
    await db.delete(authAbuseBuckets)
    form.set('password', 'short')
    for (let index = 0; index < 10; index++) assert.equal((await runRequest(requestStore(), () => registerAction(form))).error, 'Password must be at least 8 characters.')
    assert.match((await runRequest(requestStore(), () => registerAction(form))).error!, /Too many authentication attempts/)
    await db.delete(authAbuseBuckets)
    const { consumeAuthAttempt } = await import('./auth-abuse')
    for (let index = 0; index < 30; index++) await consumeAuthAttempt(new Headers(), `route-password:${index}`)
    assert.match((await runRequest(requestStore(), () => loginAction(form))).error!, /Too many authentication attempts/)
  } finally {
    await db.delete(users).where(eq(users.email, email))
    await db.delete(authAbuseBuckets)
  }
})

after(async () => {
  const { db } = await import('../db')
  await db.$client.end()
})
