import assert from 'node:assert/strict'
import test from 'node:test'
import { diffServiceConfig } from './service-config-diff'

test('reports saved values which differ from the running JobSpec', () => {
  const saved = { image: 'app:v2', replicas: 2, cpu: 500, memory: 256, deploymentStrategy: 'rolling', healthCheckType: null, healthCheckPath: null, healthCheckPort: null, healthCheckCommand: [], envVars: { A: '2' } } as never
  const running = { task_groups: [{ count: 1, update: { strategy: 'rolling' }, tasks: [{ image: 'app:v1', resources: { cpu: 500, memory: 256 }, env: { A: '1' } }] }] }
  assert.deepEqual(diffServiceConfig(saved, running).map((row) => row.key), ['image', 'replicas', 'env'])
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
