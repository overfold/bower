import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJobSpec, normalizeContainerImage, type BowerServiceConfig } from './job-builder'

const base: BowerServiceConfig = {
  name: 'api-green', serviceLabel: 'api', namespace: 'shop-production', image: 'ghcr.io/acme/api:v2',
  replicas: 2, cpu: 250, memory: 268435456, healthCheckType: 'http', healthCheckPort: 9090, healthCheckPath: '/ready',
  healthCheckInterval: 7, healthCheckTimeout: 3, healthCheckThreshold: 4, deploymentStrategy: 'rolling',
  envVars: { LOG_LEVEL: 'info' }, labels: { team: 'platform' },
  secrets: [{ name: 'DATABASE_URL', target: 'env', env: 'DATABASE_URL' }],
  volumes: [{ name: 'cache', host_path: '@/cache', container_path: '/cache' }],
  runtime: 'runsc',
  apiAccess: { scope: 'cluster', access: 'read' },
}

test('builds a complete workload with Bower-owned networking and advanced settings', () => {
  const spec = buildJobSpec(base); const group = spec.task_groups[0]; const primary = group.tasks[0]
  assert.equal(spec.name, 'api-green'); assert.equal(group.count, 2); assert.equal(group.labels?.['bower/service'], 'api')
  assert.equal(group.runtime, 'runsc'); assert.deepEqual(group.api_access, { scope: 'cluster', access: 'read' })
  assert.equal(group.tasks.length, 1); assert.deepEqual(primary.networking, { mode: 'namespace' })
  assert.equal(primary.health_check?.port, 9090); assert.equal(primary.health_check?.interval, 7_000_000_000); assert.equal(primary.secrets?.[0].env, 'DATABASE_URL')
  assert.equal(primary.volumes?.[0].container_path, '/cache'); assert.equal(primary.volumes?.[0].host_path, '@/cache')
  assert.equal(primary.image, 'ghcr.io/acme/api:v2')
  assert.equal('command' in primary, false)
  assert.equal('ports' in primary.networking, false)
})

test('defaults unqualified container images to Docker Hub', () => {
  assert.equal(normalizeContainerImage('nginx:alpine'), 'docker.io/library/nginx:alpine')
  assert.equal(normalizeContainerImage('acme/api:v2'), 'docker.io/acme/api:v2')
  assert.equal(normalizeContainerImage('ghcr.io/acme/api:v2'), 'ghcr.io/acme/api:v2')
  assert.equal(normalizeContainerImage('localhost:5000/acme/api:v2'), 'localhost:5000/acme/api:v2')
})

test('rolling and Bower-orchestrated strategies retain rolling within jobs at any replica count', () => {
  for (const deploymentStrategy of ['rolling', 'blue_green', 'canary'] as const) {
    for (const replicas of [1, 4]) {
      const group = buildJobSpec({ ...base, replicas, deploymentStrategy }).task_groups[0]
      assert.equal(group.count, replicas)
      assert.deepEqual(group.update, { strategy: 'rolling', max_parallel: 1 })
    }
  }
})

test('explicit recreate remains recreate, even when rolling could be used', () => {
  for (const replicas of [1, 4]) {
    const group = buildJobSpec({ ...base, replicas, deploymentStrategy: 'recreate' }).task_groups[0]
    assert.deepEqual(group.update, { strategy: 'recreate' })
  }
})

test('preserves Bower health and restart defaults and converts asymmetric health inputs to nanoseconds', () => {
  const group = buildJobSpec({ ...base, healthCheckInterval: undefined, healthCheckTimeout: undefined, healthCheckThreshold: undefined }).task_groups[0]
  assert.deepEqual(group.restart, { max_restarts: 3, window: 300_000_000_000 })
  assert.deepEqual(group.tasks[0].health_check, { type: 'http', port: 9090, path: '/ready', interval: 10_000_000_000, timeout: 2_000_000_000, threshold: 3 })
  assert.deepEqual(buildJobSpec(base).task_groups[0].tasks[0].health_check, {
    type: 'http', port: 9090, path: '/ready', interval: 7_000_000_000, timeout: 3_000_000_000, threshold: 4,
  })
})
