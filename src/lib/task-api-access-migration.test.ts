import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import postgres from 'postgres'

test('task access migration retains grants, disabled overrides and unrelated configuration', { skip: !process.env.BOWER_TEST_DATABASE_URL }, async () => {
  const sql = postgres(process.env.BOWER_TEST_DATABASE_URL!, { max: 1 })
  try {
    await sql.begin(async (sql) => {
      // Temporary tables shadow real tables; no persisted application data is touched.
      for (const table of ['base_service_configs', 'service_configs']) {
        await sql.unsafe(`CREATE TEMP TABLE ${table} (
          id integer, api_access_scope text, api_access_level text, overrides jsonb,
          CONSTRAINT ${table}_api_scope_check CHECK (api_access_scope IS NULL OR api_access_scope = 'cluster'),
          CONSTRAINT ${table}_api_pair_check CHECK ((api_access_scope IS NULL) = (api_access_level IS NULL)),
          CONSTRAINT ${table}_api_level_check CHECK (api_access_level IS NULL OR api_access_level IN ('read', 'write'))
        ) ON COMMIT DROP`)
      }
      await sql`INSERT INTO base_service_configs VALUES (1, 'cluster', 'write', NULL), (2, NULL, NULL, NULL)`
      await sql`INSERT INTO service_configs VALUES
        (1, 'cluster', 'read', '{"apiAccessScope":"cluster","apiAccessLevel":"read","runtime":"runsc"}'),
        (2, NULL, NULL, '{"apiAccessScope":null,"apiAccessLevel":null}'),
        (3, 'cluster', 'write', '{"apiAccessScope":"cluster"}'),
        (4, NULL, NULL, '{"apiAccessScope":null,"replicas":2}'),
        (5, 'cluster', 'read', NULL), (6, NULL, NULL, '{"replicas":3}')`
      await sql`CREATE TEMP TABLE deployments (id integer, job_spec jsonb, previous_job_spec jsonb) ON COMMIT DROP`
      const oldSpec = { name: 'web', namespace: 'production', task_groups: [
        { name: 'app', count: 1, runtime: 'runsc', api_access: { scope: 'cluster', access: 'read' }, tasks: [{ name: 'web', image: 'web@sha256:old' }, { name: 'sidecar', image: 'sidecar@sha256:old' }] },
        { name: 'disabled', count: 1, api_access: { scope: 'namespace', access: 'write' }, tasks: [{ name: 'worker', image: 'worker:v1' }] },
      ] }
      const currentSpec = { name: 'web', namespace: 'production', task_groups: [
        { name: 'app', count: 1, tasks: [{ name: 'web', image: 'web:v2', runtime: 'runc', api_access: { access: 'write' } }, { name: 'sidecar', image: 'sidecar:v2', runtime: 'runsc' }] },
      ] }
      await sql`INSERT INTO deployments VALUES (1, ${sql.json(oldSpec)}, ${sql.json(currentSpec)}), (2, NULL, NULL)`
      const migration = readFileSync('drizzle/0030_task_api_access.sql', 'utf8')
      for (const statement of migration.split('--> statement-breakpoint')) await sql.unsafe(statement)
      assert.deepEqual(Array.from(await sql`SELECT id, api_access_level, overrides FROM service_configs ORDER BY id`), [
        { id: 1, api_access_level: 'read', overrides: { apiAccessLevel: 'read', runtime: 'runsc' } },
        { id: 2, api_access_level: null, overrides: { apiAccessLevel: null } },
        { id: 3, api_access_level: 'write', overrides: { apiAccessLevel: 'write' } },
        { id: 4, api_access_level: null, overrides: { apiAccessLevel: null, replicas: 2 } },
        { id: 5, api_access_level: 'read', overrides: null },
        { id: 6, api_access_level: null, overrides: { replicas: 3 } },
      ])
      assert.deepEqual(Array.from(await sql`SELECT api_access_level FROM base_service_configs ORDER BY id`), [{ api_access_level: 'write' }, { api_access_level: null }])
      const columns = await sql`SELECT attname FROM pg_attribute WHERE attrelid = 'pg_temp.service_configs'::regclass AND attname = 'api_access_scope' AND NOT attisdropped`
      assert.equal(columns.length, 0)
      const releases = await sql`SELECT job_spec, previous_job_spec FROM deployments ORDER BY id`
      assert.deepEqual(releases[0].job_spec, { name: 'web', namespace: 'production', task_groups: [
        { name: 'app', count: 1, tasks: [{ name: 'web', image: 'web@sha256:old', runtime: 'runsc', api_access: { access: 'read' } }, { name: 'sidecar', image: 'sidecar@sha256:old', runtime: 'runsc', api_access: { access: 'read' } }] },
        { name: 'disabled', count: 1, tasks: [{ name: 'worker', image: 'worker:v1', runtime: 'runc' }] },
      ] })
      assert.deepEqual(releases[0].previous_job_spec, currentSpec)
      assert.deepEqual(releases[1], { job_spec: null, previous_job_spec: null })
    })
  } finally { await sql.end() }
})
