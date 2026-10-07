import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { effectiveBucketSeconds, metricsWindow } from './metrics-series'

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
    from() { return this }, where(sql: SQL) { onWhere?.(sql); return this }, limit() { return this }, groupBy() { return this }, orderBy() { return this },
  })
}

const NOW = Date.UTC(2026, 9, 7, 12, 3, 40)
const dialect = new PgDialect()

function setup(options: { role?: string; environments?: unknown[]; samples?: unknown[]; deployments?: unknown[] } = {}) {
  const calls = { audits: 0, selects: 0, environmentParams: [] as unknown[][], sampleParams: [] as unknown[][], sampleSql: [] as string[], deploymentParams: [] as unknown[][], deploymentSql: [] as string[] }
  const actions = load<typeof import('./actions/metrics-actions')>('src/lib/actions/metrics-actions.ts', {
    '@/lib/actions/shared': {
      requireService: async () => ({ user: { id: 'user' }, org: { id: 'org' }, service: { id: 'service', projectId: 'project-a' }, projectRole: options.role ?? 'viewer' }),
      recordAudit: async () => { calls.audits++ },
    },
    '@/db': { db: { select: (shape: object) => {
      calls.selects++
      if ('startedAt' in shape) return query(options.deployments ?? [], (sql) => { const built = dialect.sqlToQuery(sql); calls.deploymentParams.push(built.params); calls.deploymentSql.push(built.sql) })
      return 'bucketStart' in shape
        ? query(options.samples ?? [], (sql) => { const built = dialect.sqlToQuery(sql); calls.sampleParams.push(built.params); calls.sampleSql.push(built.sql) })
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
    assert.equal(calls.selects, 1, 'neither samples nor deployments are read')
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

test('without an allocation the samples are not narrowed to one, and the service total is unchanged', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    const { actions, calls } = setup()
    await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h' })
    assert.doesNotMatch(calls.sampleSql[0], /"allocation_id" = \$/)
  } finally { mock.timers.reset() }
})

test('an allocation filter always carries the service, so another service\'s allocation matches no sample and Trellis is never asked', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    // The mocked database cannot run SQL, so check the predicate it is given: the allocation is only ever matched together with this service and environment.
    const { actions, calls } = setup({ samples: [] })
    const series = await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h', allocationId: 'alloc-of-another-service' })
    const where = calls.sampleSql[0]
    assert.match(where, /"allocation_metric_samples"\."service_id" = \$\d+/)
    assert.match(where, /"allocation_metric_samples"\."environment_id" = \$\d+/)
    assert.match(where, /"allocation_metric_samples"\."allocation_id" = \$\d+/)
    assert.ok(calls.sampleParams[0].includes('service') && calls.sampleParams[0].includes('alloc-of-another-service'))
    assert.ok(series.points.every((point) => point.cpu === null && point.memory === null), 'no rows, so every bucket is a gap')
    assert.deepEqual(structuredClone(series.deployments), [])
    // The action does not even import a Trellis client, so a stopped or replaced allocation stays readable.
    assert.doesNotMatch(readFileSync(resolve('src/lib/actions/metrics-actions.ts'), 'utf8'), /from '[^']*trellis/i)
  } finally { mock.timers.reset() }
  const { actions } = setup()
  await assert.rejects(actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h', allocationId: { $ne: '' } as never }), /Invalid allocation/)
})

test('an allocation keeps the same bucketing as the service series', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    const t = Math.floor(NOW / 60_000) * 60_000 - 120_000
    const { actions } = setup({ samples: [{ bucketStart: t, allocationId: 'a', cpuAvg: 100, cpuMax: 120, memoryAvg: 1000, memoryMax: 1200 }] })
    const series = await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h', allocationId: 'a' })
    assert.equal(series.bucketSeconds, 60)
    assert.equal(series.points.length, 60)
    assert.deepEqual({ ...series.points.find((point) => point.t === t) }, { t, cpu: 100, cpuPeak: 120, memory: 1000, memoryPeak: 1200 })
  } finally { mock.timers.reset() }
})

test('deployments are the service\'s and environment\'s own, started inside the window, reduced to what a marker needs', async () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    const startedAt = new Date(NOW - 20 * 60_000)
    const { actions, calls } = setup({ deployments: [{ id: 'deploy-1', startedAt, status: 'healthy', image: 'ghcr.io/acme/web:v2.4.1' }] })
    const series = await actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env', range: '1h' })
    assert.deepEqual(structuredClone(series.deployments), [{ id: 'deploy-1', startedAt: startedAt.getTime(), status: 'healthy', image: 'ghcr.io/acme/web:v2.4.1' }])
    const sql = calls.deploymentSql[0]
    assert.match(sql, /"deployments"\."service_id" = \$\d+/)
    assert.match(sql, /"deployments"\."environment_id" = \$\d+/)
    assert.match(sql, /"deployments"\."started_at" >= \$\d+/)
    assert.match(sql, /"deployments"\."started_at" < \$\d+/)
    const window = metricsWindow('1h', NOW, effectiveBucketSeconds('1h', 30))
    assert.deepEqual(calls.deploymentParams[0], ['service', 'env', new Date(window.from).toISOString(), new Date(window.to).toISOString()])
    // Authorization is unchanged: an environment of another project never reaches the deployments table.
    const rejected = setup({ environments: [], deployments: [{ id: 'x', startedAt, status: 'healthy', image: 'i' }] })
    await assert.rejects(rejected.actions.getServiceMetricsSeries({ serviceId: 'service', environmentId: 'env-other', range: '1h' }), /Environment not found/)
    assert.equal(rejected.calls.deploymentSql.length, 0)
  } finally { mock.timers.reset() }
})
