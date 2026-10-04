import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Follow the boundary-test pattern: run the real module with controlled I/O.
function loadMigrations(failures: unknown[], connectionString: string | undefined = 'postgres://fixture') {
  const events: string[] = []
  const messages: string[] = []
  const waits: number[] = []
  let attempts = 0
  const filename = resolve('exec/migrate.mjs')
  const source = readFileSync(filename, 'utf8').replace('import.meta.url', '"file:///test/migrate.ts"')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  })
  const dependencies: Record<string, unknown> = {
    postgres: (url: string, options: unknown) => {
      assert.equal(url, connectionString)
      assert.deepEqual(JSON.parse(JSON.stringify(options)), { max: 1, connect_timeout: 5 })
      const attempt = ++attempts
      events.push(`open ${attempt}`)
      return { end: async (options: unknown) => {
        assert.deepEqual(JSON.parse(JSON.stringify(options)), { timeout: 5 })
        events.push(`close ${attempt}`)
      } }
    },
    'drizzle-orm/postgres-js': { drizzle: (client: unknown) => client },
    'drizzle-orm/postgres-js/migrator': { migrate: async (_db: unknown, options: unknown) => {
      assert.deepEqual(JSON.parse(JSON.stringify(options)), { migrationsFolder: './drizzle' })
      events.push(`migrate ${attempts}`)
      if (attempts <= failures.length) throw failures[attempts - 1]
    } },
    'node:timers/promises': { setTimeout: async (ms: number) => {
      waits.push(ms)
      events.push('wait')
    } },
  }
  const loaded = { exports: {} }
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, Error,
    process: { env: { DATABASE_URL: connectionString }, argv: [] },
    console: { log: (message: string) => messages.push(message), warn: (message: string) => messages.push(message) },
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  }, { filename })
  return { ...loaded.exports as typeof import('../../exec/migrate.mjs'), events, messages, waits }
}

function connectionError(code: string) {
  return new Error('Failed query', {
    cause: Object.assign(new Error('Database unavailable'), { code }),
  })
}

test('successful migrations run once and close the connection', async () => {
  const migration = loadMigrations([])
  await migration.runMigrations()
  assert.deepEqual(migration.events, ['open 1', 'migrate 1', 'close 1'])
  assert.deepEqual(migration.messages, ['Running migrations...', 'Migrations complete.'])
})

test('wrapped DNS and PostgreSQL readiness errors retry after closing each connection', async () => {
  const migration = loadMigrations([connectionError('ENOTFOUND'), connectionError('57P03')])
  await migration.runMigrations()
  assert.deepEqual(migration.events, [
    'open 1', 'migrate 1', 'close 1', 'wait',
    'open 2', 'migrate 2', 'close 2', 'wait',
    'open 3', 'migrate 3', 'close 3',
  ])
  assert.ok(migration.messages.some(message => message.includes('attempt 2)')))
  assert.deepEqual(migration.waits, [2000, 4000])
  assert.equal(migration.messages.at(-1), 'Migrations complete.')
  assert.ok(migration.messages.every(message => !message.includes('postgres://fixture')))
})

test('transient failures recover beyond the old budget with capped exponential backoff', async () => {
  const migration = loadMigrations(Array.from({ length: 12 }, () => connectionError('ECONNREFUSED')))
  await migration.runMigrations()
  assert.equal(migration.events.filter(event => event === 'wait').length, 12)
  assert.equal(migration.events.at(-1), 'close 13')
  assert.deepEqual(migration.waits, [2000, 4000, 8000, 16000, ...Array(8).fill(30000)])
  assert.equal(migration.messages.at(-1), 'Migrations complete.')
})

test('a fatal error after a prolonged transient outage stops retries and preserves the error', async () => {
  const fatal = connectionError('28P01')
  const failures = [...Array.from({ length: 11 }, () => connectionError('EAI_AGAIN')), fatal]
  const migration = loadMigrations(failures)
  await assert.rejects(migration.runMigrations(), error => error === fatal)
  assert.equal(migration.events.filter(event => event.startsWith('open ')).length, 12)
  assert.equal(migration.events.filter(event => event.startsWith('close ')).length, 12)
  assert.equal(migration.events.filter(event => event === 'wait').length, 11)
  assert.equal(migration.events.at(-1), 'close 12')
  assert.ok(!migration.messages.includes('Migrations complete.'))
})

test('authentication, SQL, and unknown errors fail immediately and close the connection', async () => {
  for (const failure of [connectionError('28P01'), connectionError('42601'), new Error('Missing migration file')]) {
    const migration = loadMigrations([failure])
    await assert.rejects(migration.runMigrations(), error => error === failure)
    assert.deepEqual(migration.events, ['open 1', 'migrate 1', 'close 1'])
    assert.deepEqual(migration.messages, ['Running migrations...'])
  }
})

test('missing DATABASE_URL fails before creating a connection', async () => {
  const migration = loadMigrations([], '')
  await assert.rejects(migration.runMigrations(), /DATABASE_URL environment variable is not set/)
  assert.deepEqual(migration.events, [])
})
