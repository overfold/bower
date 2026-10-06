import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'

// Drizzle wraps driver errors; the Postgres error (SQLSTATE and constraint) is on `cause`.
function foreignKeyViolation(constraint: string) {
  return (error: unknown) => {
    const cause = (error as { cause?: { code?: string; constraint_name?: string } }).cause
    assert.equal(cause?.code, '23503')
    assert.equal(cause?.constraint_name, constraint)
    return true
  }
}

test('service configs cannot pair a service and environment from different projects', { skip: !process.env.BOWER_TEST_DATABASE_URL }, async (t) => {
  const { db } = await import('./index')
  const { organizations, projects, environments, services, serviceConfigs } = await import('./schema')
  const [org] = await db.insert(organizations).values({ name: 'Integrity test', slug: randomUUID(), trellisApiUrl: '', trellisApiToken: '' }).returning()
  t.after(async () => { await db.delete(organizations).where(eq(organizations.id, org.id)) })
  const [projectA, projectB] = await db.insert(projects).values([
    { orgId: org.id, name: 'A', slug: 'a' },
    { orgId: org.id, name: 'B', slug: 'b' },
  ]).returning()
  const [environmentA, environmentB] = await db.insert(environments).values([
    { projectId: projectA.id, name: 'Test', slug: 'test', trellisNamespace: 'integrity-a' },
    { projectId: projectB.id, name: 'Test', slug: 'test', trellisNamespace: 'integrity-b' },
  ]).returning()
  const [serviceA] = await db.insert(services).values({ projectId: projectA.id, name: 'Web', slug: 'web' }).returning()
  const config = { image: 'unused', cpu: 100, memory: 128, resourceTier: 'small' as const }

  // Environment from another project: rejected whichever project the row claims.
  await assert.rejects(
    db.insert(serviceConfigs).values({ ...config, projectId: projectA.id, serviceId: serviceA.id, environmentId: environmentB.id }),
    foreignKeyViolation('service_configs_environment_project_fkey'),
  )
  await assert.rejects(
    db.insert(serviceConfigs).values({ ...config, projectId: projectB.id, serviceId: serviceA.id, environmentId: environmentB.id }),
    foreignKeyViolation('service_configs_service_project_fkey'),
  )
  assert.deepEqual(await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceA.id)), [])

  const [valid] = await db.insert(serviceConfigs).values({ ...config, projectId: projectA.id, serviceId: serviceA.id, environmentId: environmentA.id }).returning()
  assert.equal(valid.projectId, projectA.id)

  // Existing rows cannot be re-pointed across projects either.
  await assert.rejects(
    db.update(serviceConfigs).set({ environmentId: environmentB.id }).where(eq(serviceConfigs.id, valid.id)),
    foreignKeyViolation('service_configs_environment_project_fkey'),
  )
})
