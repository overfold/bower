import assert from 'node:assert/strict'
import test from 'node:test'
import { diffJobSpecs, diffServiceConfig } from './service-config-diff'

test('reports saved values which differ from the running JobSpec', () => {
  const saved = { image: 'app:v2', replicas: 2, cpu: 500, memory: 256, deploymentStrategy: 'rolling', healthCheckType: null, healthCheckPath: null, healthCheckPort: null, healthCheckCommand: [], envVars: { A: '2' } } as never
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 500, memory: 256 }, env: { A: '1' } }] }] }
  assert.deepEqual(diffServiceConfig(saved, running).map((row) => row.key), ['image', 'replicas', 'env.A'])
})

test('has no changes when the saved config matches the running release', () => {
  const saved = { image: 'app:v1', replicas: 1, cpu: 100, memory: 128, deploymentStrategy: 'rolling', healthCheckType: null, healthCheckPath: null, healthCheckPort: null, healthCheckCommand: [], envVars: {} } as never
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 100, memory: 128 }, env: {} }] }] }
  assert.equal(diffServiceConfig(saved, running).length, 0)
})

test('compares health, env, and secret bindings semantically without exposing values', () => {
  const saved = { image: 'app:v1', replicas: 1, cpu: 100, memory: 128, deploymentStrategy: 'rolling', healthCheckType: 'http', healthCheckPath: '/', healthCheckPort: null, healthCheckCommand: [], healthCheckInterval: 10, healthCheckTimeout: 2, healthCheckThreshold: 3, envVars: { B: '2', A: '1' }, secretBindings: [{ env: 'TOKEN', target: 'env', name: 'token' }] }
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 100, memory: 128 }, env: { A: '1', B: '2' }, secrets: [{ name: 'token', target: 'env', env: 'TOKEN', mode: 0o400 }], health_check: { type: 'http', path: '/', interval: 10e9, timeout: 2e9, threshold: 3 } }] }] }
  assert.deepEqual(diffServiceConfig(saved as never, running), [])
  const changed = diffServiceConfig({ ...saved, secretBindings: [{ name: 'other', target: 'env', env: 'TOKEN' }] } as never, running)
  assert.deepEqual(changed.map((row) => row.key), ['secrets'])
  assert.doesNotMatch(JSON.stringify(changed), /secret-value/)
})

test('returns structured resources and added, changed, and removed environment rows with plain values visible', () => {
  const saved = { image: 'app:v1', replicas: 1, cpu: 500, memory: 268435456, deploymentStrategy: 'rolling', healthCheckType: null, envVars: { TOKEN: 'new', ADDED: 'x' }, secretBindings: [] } as never
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 100, memory: 134217728 }, env: { TOKEN: 'old', REMOVED: 'gone' } }] }] }
  const changes = diffServiceConfig(saved, running)
  assert.equal(changes.find((row) => row.key === 'cpu')?.after, 500)
  assert.equal(changes.find((row) => row.key === 'memory')?.after, 268435456)
  assert.deepEqual(changes.filter((row) => row.kind === 'environment').map((row) => [row.change, row.variable, row.before, row.after]), [
    ['Added', 'ADDED', { present: false, masked: false }, { present: true, masked: false, value: 'x' }],
    ['Removed', 'REMOVED', { present: true, masked: false, value: 'gone' }, { present: false, masked: false }],
    ['Changed', 'TOKEN', { present: true, masked: false, value: 'old' }, { present: true, masked: false, value: 'new' }],
  ])
})

test('secret-bound variables stay masked and their values never appear', () => {
  const running = { task_groups: [{ count: 1, tasks: [{ image: 'app:v1', resources: { cpu: 100, memory: 128 }, env: { PORT: '8080' }, secrets: [{ name: 'token', target: 'env', env: 'TOKEN' }] }] }] }
  const saved = { image: 'app:v1', replicas: 1, cpu: 100, memory: 128, deploymentStrategy: 'rolling', healthCheckType: null, envVars: { PORT: '9090', TOKEN: 'secret-value' }, secretBindings: [{ name: 'other', target: 'env', env: 'TOKEN' }] } as never
  const environment = diffServiceConfig(saved, running).filter((row) => row.kind === 'environment')
  assert.deepEqual(environment.map((row) => [row.variable, row.before, row.after]), [
    ['PORT', { present: true, masked: false, value: '8080' }, { present: true, masked: false, value: '9090' }],
    ['TOKEN', { present: true, masked: true }, { present: true, masked: true }],
  ])
  assert.doesNotMatch(JSON.stringify(environment), /secret-value/)
})

test('values absent from a stored spec are not recorded, not "none"', () => {
  const selected = { task_groups: [{ count: 1, tasks: [{ image: 'web:v1' }] }] }
  const running = { task_groups: [{ count: 1, tasks: [{ image: 'web:v2', resources: { cpu: 500, memory: 512 }, health_check: { type: 'http', path: '/', interval: 10e9, timeout: 2e9, threshold: 3 } }] }] }
  const changes = diffJobSpecs(selected, running)
  for (const key of ['cpu', 'memory', 'health']) {
    const change = changes.find((entry) => entry.key === key)
    assert.ok(change?.kind === 'config', key)
    assert.equal(change.afterRecorded, false, key)
    assert.equal(change.beforeRecorded, undefined, key)
  }
  // Explicitly recorded values keep plain shapes, and non-resource keys never carry the flag.
  assert.equal(changes.find((entry) => entry.key === 'image')?.kind === 'config' && 'afterRecorded' in changes.find((entry) => entry.key === 'image')!, false)
})

test('structured health commands retain argument order', () => {
  const saved = { image: 'app:v1', replicas: 1, cpu: 100, memory: 128, deploymentStrategy: 'rolling', healthCheckType: 'script', healthCheckCommand: ['check', 'database'], healthCheckInterval: 10, healthCheckTimeout: 2, healthCheckThreshold: 3, envVars: {} } as never
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 100, memory: 128 }, health_check: { type: 'script', command: ['database', 'check'], interval: 10e9, timeout: 2e9, threshold: 3 } }] }] }
  const health = diffServiceConfig(saved, running).find((row) => row.key === 'health')
  assert.ok(health?.kind === 'config')
  assert.deepEqual((health.after as { command: string[] }).command, ['check', 'database'])
  assert.deepEqual((health.before as { command: string[] }).command, ['database', 'check'])
})

test('rollback previews stored resources, mounts and environment differences', () => {
  const running = { task_groups: [{ count: 3, runtime: 'runsc', tasks: [{ image: 'web:v3', resources: { cpu: 500, memory: 512 }, env: { TOKEN: 'new-private', ADDED: 'private' }, volumes: [{ name: 'uploads', container_path: '/uploads' }] }] }] }
  const selected = { task_groups: [{ count: 1, runtime: 'runc', tasks: [{ image: 'web:v1', resources: { cpu: 100, memory: 128 }, env: { TOKEN: 'old-private' } }] }] }
  const changes = diffJobSpecs(selected, running)
  assert.deepEqual(changes.map((change) => change.key), ['image', 'replicas', 'cpu', 'memory', 'volumes', 'runtime', 'env.ADDED', 'env.TOKEN'])
  assert.deepEqual(changes.find((change) => change.key === 'replicas'), { kind: 'config', key: 'replicas', label: 'Replicas', before: 3, after: 1 })
  assert.deepEqual(changes.find((change) => change.key === 'env.ADDED'), { kind: 'environment', key: 'env.ADDED', label: 'Environment', variable: 'ADDED', change: 'Removed', before: { present: true, masked: false, value: 'private' }, after: { present: false, masked: false } })
  assert.deepEqual(diffJobSpecs(selected, selected), [])
})
