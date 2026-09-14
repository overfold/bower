import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJobSpec, type BowerServiceConfig } from './job-builder'

const base: BowerServiceConfig = {
  name: 'api-green', serviceLabel: 'api', namespace: 'shop-production', image: 'ghcr.io/acme/api:v2',
  port: 8080, replicas: 2, cpu: 250, memory: 268435456, healthCheckType: 'http', healthCheckPath: '/ready',
  healthCheckInterval: 7, healthCheckTimeout: 3, healthCheckThreshold: 4, deploymentStrategy: 'rolling',
  envVars: { LOG_LEVEL: 'info' }, labels: { team: 'platform' }, command: '/app/server',
  secrets: [{ name: 'DATABASE_URL', target: 'env', env: 'DATABASE_URL' }],
  volumes: [{ name: 'cache', host_path: '@/cache', container_path: '/cache' }],
  sidecars: [{ name: 'otel', image: 'otel/opentelemetry-collector:latest', cpu: 100, memory: 67108864, port: 4317, envVars: {} }],
  runtime: 'runsc',
  apiAccess: { scope: 'namespace', access: 'read' },
}

test('builds a complete workload with Bower-owned networking and advanced settings', () => {
  const spec = buildJobSpec(base); const group = spec.task_groups[0]; const primary = group.tasks[0]
  assert.equal(spec.name, 'api-green'); assert.equal(group.count, 2); assert.equal(group.labels?.['bower/service'], 'api')
  assert.equal(group.runtime, 'runsc'); assert.deepEqual(group.api_access, { scope: 'namespace', access: 'read' })
  assert.deepEqual(primary.networking, { mode: 'namespace' }); assert.deepEqual(group.tasks[1].networking, { mode: 'namespace' })
  assert.equal(primary.health_check?.interval, 7_000_000_000); assert.equal(primary.secrets?.[0].env, 'DATABASE_URL')
  assert.equal(primary.volumes?.[0].container_path, '/cache'); assert.equal(primary.volumes?.[0].host_path, '@/cache')
})

test('custom raw specs keep Bower identity and cannot opt out of managed networking', () => {
  const raw = {
    name: 'ignored', namespace: 'ignored',
    task_groups: [{
      name: 'custom', count: 1, runtime: 'runc' as const,
      api_access: { scope: 'cluster' as const, access: 'write' as const },
      tasks: [{ name: 'task', image: 'busybox', networking: { mode: 'host' as const, ports: [{ port: 8080 }] } }],
    }],
  }
  const spec = buildJobSpec({ ...base, rawConfig: raw })
  const group = spec.task_groups[0]
  assert.equal(spec.name, base.name); assert.equal(spec.namespace, base.namespace)
  assert.equal(group.tasks[0].image, 'busybox'); assert.equal(group.labels?.['bower/service'], 'api')
  assert.equal(group.runtime, 'runsc'); assert.deepEqual(group.api_access, { scope: 'namespace', access: 'read' })
  assert.deepEqual(group.tasks[0].networking, { mode: 'namespace' })
})
