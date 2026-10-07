import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

// Same approach as trellis-boundaries.test.ts: run the real action module with its I/O replaced.
function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const filename = resolve(path)
  const require = createRequire(filename)
  const loaded = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  })
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, Date, Promise, process, Object, Number, Error,
    require: (name: string) => name in dependencies ? dependencies[name] : require(name.startsWith('@/') ? resolve('src', name.slice(2)) : name),
  }, { filename })
  return loaded.exports as T
}

function query(rows: unknown[], onWhere?: (sql: SQL) => void) {
  return Object.assign(Promise.resolve(rows), {
    from() { return this }, where(sql: SQL) { onWhere?.(sql); return this }, limit() { return this }, groupBy() { return this },
  })
}

const NOW = Date.UTC(2026, 9, 7, 12, 3, 40)
const dialect = new PgDialect()

function setup(options: { role?: string; environments?: unknown[]; samples?: unknown[] } = {}) {
  const calls = { audits: 0, selects: 0, environmentParams: [] as unknown[][], sampleParams: [] as unknown[][] }
  const actions = load<typeof import('./actions/metrics-actions')>('src/lib/actions/metrics-actions.ts', {
    '@/lib/actions/shared': {
      requireService: async () => ({ user: { id: 'user' }, org: { id: 'org' }, service: { id: 'service', projectId: 'project-a' }, projectRole: options.role ?? 'viewer' }),
      recordAudit: async () => { calls.audits++ },
    },
    '@/db': { db: { select: (shape: object) => {
      calls.selects++
      return 'bucketStart' in shape
        ? query(options.samples ?? [], (sql) => calls.sampleParams.push(dialect.sqlToQuery(sql).params))
        : query(options.environments ?? [{ id: 'env' }], (sql) => calls.environmentParams.push(dialect.sqlToQuery(sql).params))
    } } },
  })
  return { actions, calls }
}

test('an environment of another project is rejected before any samples are read', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    const { actions, calls } = setup({ environments: [] })
    await assert.rejects(actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env-other', range: '1h' }), /Environment not found/)
    assert.equal(calls.selects, 1)
    // The environment lookup is scoped to the service's own project, not just to the id.
    assert.ok(calls.environmentParams[0].includes('project-a'))
    assert.ok(calls.environmentParams[0].includes('env-other'))
  } finally { mock.timers.reset() }
})

test('a viewer can read the series, scoped to the service and environment, with no audit entry', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    const t = Math.floor(NOW / 60_000) * 60_000 - 120_000
    const { actions, calls } = setup({
      role: 'viewer',
      samples: [
        { bucketStart: t, allocationId: 'a', cpuAvg: '100', cpuMax: 120, memoryAvg: 1000, memoryMax: '1200' },
        { bucketStart: t, allocationId: 'b', cpuAvg: null, cpuMax: null, memoryAvg: 500, memoryMax: 500 },
      ],
    })
    const series = await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h' })
    // 1h nominally uses 15 s buckets; the default 30 s sampling cadence widens them to 1 min.
    assert.equal(series.points.length, 60)
    assert.equal(series.bucketSeconds, 60)
    const point = series.points.find((item) => item.t === t)!
    assert.deepEqual({ cpu: point.cpu, cpuPeak: point.cpuPeak, memory: point.memory, memoryPeak: point.memoryPeak }, { cpu: 100, cpuPeak: 120, memory: 1500, memoryPeak: 1700 })
    assert.equal(series.points.filter((item) => item.cpu === null).length, 59)
    assert.ok(calls.sampleParams[0].includes('service') && calls.sampleParams[0].includes('env'))
    assert.equal(calls.audits, 0)
  } finally { mock.timers.reset() }
})

test('a range longer than the configured retention is rejected without reading samples', async () => {
  const previous = process.env.BOWER_METRICS_RETENTION_HOURS
  process.env.BOWER_METRICS_RETENTION_HOURS = '6'
  try {
    const { actions, calls } = setup()
    await assert.rejects(actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '24h' }), /retained for 6 hours/)
    await assert.rejects(actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '30d' }), /Unsupported metrics range/)
    assert.equal(calls.selects, 2)
    await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '6h' })
  } finally {
    if (previous === undefined) delete process.env.BOWER_METRICS_RETENTION_HOURS
    else process.env.BOWER_METRICS_RETENTION_HOURS = previous
  }
})
