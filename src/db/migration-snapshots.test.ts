import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { generateDrizzleJson, generateMigration, type DrizzleSnapshotJSON } from 'drizzle-kit/api'
import { pgTable, text } from 'drizzle-orm/pg-core'
import * as schema from './schema'
import * as domains from './domain-schema'

const snapshotFiles = readdirSync('drizzle/meta').filter(name => name.endsWith('_snapshot.json')).sort()
const snapshots: DrizzleSnapshotJSON[] = snapshotFiles.map(name =>
  JSON.parse(readFileSync(`drizzle/meta/${name}`, 'utf8')),
)
const latest = snapshots.at(-1)!

test('migration snapshots form a unique chain ending at the latest journal entry', () => {
  const ids = new Set<string>()
  let parent = '00000000-0000-0000-0000-000000000000'
  for (const snapshot of snapshots) {
    assert.equal(snapshot.prevId, parent)
    assert.ok(!ids.has(snapshot.id), `Duplicate snapshot ID: ${snapshot.id}`)
    ids.add(snapshot.id)
    parent = snapshot.id
  }
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
  const lastEntry = journal.entries.at(-1)
  assert.equal(snapshotFiles.at(-1), `${String(lastEntry.idx).padStart(4, '0')}_snapshot.json`)
  assert.ok(readFileSync(`drizzle/${lastEntry.tag}.sql`, 'utf8').length > 0)
})

test('the current schema generates no migration from the repaired baseline', async () => {
  const current = generateDrizzleJson({ ...schema, ...domains }, latest.id)
  assert.deepEqual(await generateMigration(latest, current), [])
})

test('a new table generates only its own SQL, not the handwritten migration history', async () => {
  const probe = pgTable('migration_snapshot_probe', { value: text('value').notNull() })
  const current = generateDrizzleJson({ ...schema, ...domains, probe }, latest.id)
  assert.deepEqual(await generateMigration(latest, current), [
    'CREATE TABLE "migration_snapshot_probe" (\n\t"value" text NOT NULL\n);\n',
  ])
})
