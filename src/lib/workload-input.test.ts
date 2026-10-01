import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCanarySteps, validateHostPath, validateSecretBindings, validateVolumeMounts } from './workload-input'

test('volume mounts enforce Trellis identifiers, exact shapes, booleans, and safe container paths', () => {
  assert.deepEqual(validateVolumeMounts([{ name: 'data.v2', container_path: '/srv/data', read_only: false }]), [
    { name: 'data.v2', container_path: '/srv/data' },
  ])
  for (const value of [
    {},
    { name: 'bad/name', container_path: '/data' },
    { name: 'data', container_path: 'data' },
    { name: 'data', container_path: '/data/../etc' },
    { name: 'data', container_path: '/run/trellis/token' },
    { name: 'data', container_path: '/data', read_only: 'yes' },
    { name: 'data', container_path: '/data', host_path: '/host' },
  ]) assert.throws(() => validateVolumeMounts([value]))
  assert.throws(() => validateVolumeMounts([
    { name: 'data', container_path: '/one' }, { name: 'data', container_path: '/two' },
  ]), /duplicated/)
})

test('secret bindings enforce target-specific Trellis shapes and Bower env names', () => {
  assert.deepEqual(validateSecretBindings([
    { name: 'db.password', target: 'env', env: '_DB_PASSWORD' },
    { name: 'tls-key', target: 'file', path: '/run/trellis-secrets/tls/key.pem' },
  ]), [
    { name: 'db.password', target: 'env', env: '_DB_PASSWORD' },
    { name: 'tls-key', target: 'file', path: '/run/trellis-secrets/tls/key.pem' },
  ])
  for (const value of [
    { name: 'secret/name', target: 'env', env: 'TOKEN' },
    { name: 'secret', target: 'env', env: 'BAD-NAME' },
    { name: 'secret', target: 'env', env: 'TOKEN', path: '/run/trellis-secrets/token' },
    { name: 'secret', target: 'file', path: '/tmp/token' },
    { name: 'secret', target: 'file', path: '/run/trellis-secrets/../token' },
    { name: 'secret', target: 'other', env: 'TOKEN' },
  ]) assert.throws(() => validateSecretBindings([value]))
  assert.throws(() => validateSecretBindings([
    { name: 'one', target: 'env', env: 'TOKEN' }, { name: 'two', target: 'env', env: 'TOKEN' },
  ]), /more than once/)
})

test('canary steps are ordered integral percentages that explicitly finish at 100', () => {
  assert.deepEqual(validateCanarySteps([1, 17, 99, 100]), [1, 17, 99, 100])
  for (const value of [[], [0, 100], [10.5, 100], [10, 10, 100], [20, 10, 100], [10, 101], [10, 50]]) {
    assert.throws(() => validateCanarySteps(value))
  }
})

test('host paths accept clean managed and absolute forms before trust admission', () => {
  for (const path of ['@/data', '@/tenant/service/data', '/srv/bower/data']) assert.doesNotThrow(() => validateHostPath(path))
  for (const path of ['@/', '@/../escape', '@/a/../b', 'relative', '/srv/../etc']) assert.throws(() => validateHostPath(path))
})
