import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertHostPathAllowed,
  assertStoredHostPathAllowed,
  assertStoredWorkloadApiAccessAllowed,
  assertWorkloadApiAccessAllowed,
  instanceAdminBypassEnabled,
  instanceAdminMayBypassMultitenancy,
} from './workload-policy'

const enabled = { BOWER_IA_BYPASS_MULTITENANCY: 'true' }

test('only instance admins may use an explicitly enabled multitenancy bypass', () => {
  assert.equal(instanceAdminBypassEnabled({}), false)
  assert.equal(instanceAdminBypassEnabled({ BOWER_IA_BYPASS_MULTITENANCY: 'TRUE' }), false)
  assert.equal(instanceAdminMayBypassMultitenancy(false, enabled), false)
  assert.equal(instanceAdminMayBypassMultitenancy(true, {}), false)
  assert.equal(instanceAdminMayBypassMultitenancy(true, enabled), true)
})

test('default tenant policy allows managed paths but denies all workload API grants', () => {
  assert.doesNotThrow(() => assertHostPathAllowed('@/project/data', false, {}))
  assert.throws(() => assertHostPathAllowed('/srv/data', false, enabled), /instance admin/)
  assert.throws(() => assertHostPathAllowed('/srv/data', true, {}), /BOWER_IA_BYPASS/)
  assert.doesNotThrow(() => assertWorkloadApiAccessAllowed(undefined, false, {}))
  for (const access of [
    { scope: 'cluster', access: 'read' },
    { scope: 'cluster', access: 'write' },
  ] as const) {
    assert.throws(() => assertWorkloadApiAccessAllowed(access, false, enabled), /instance admin/)
    assert.throws(() => assertWorkloadApiAccessAllowed(access, true, {}), /BOWER_IA_BYPASS/)
    assert.doesNotThrow(() => assertWorkloadApiAccessAllowed(access, true, enabled))
  }
})

test('instance admin with bypass enabled may configure privileged capabilities', () => {
  assert.doesNotThrow(() => assertHostPathAllowed('/srv/data', true, enabled))
  assert.doesNotThrow(() => assertWorkloadApiAccessAllowed({ scope: 'cluster', access: 'write' }, true, enabled))
})

test('deployment permits stored privileged capabilities only while the operator bypass remains enabled', () => {
  assert.throws(() => assertStoredHostPathAllowed('/srv/data', {}), /not enabled/)
  assert.doesNotThrow(() => assertStoredHostPathAllowed('/srv/data', enabled))
  assert.doesNotThrow(() => assertStoredWorkloadApiAccessAllowed(undefined, {}))
  for (const access of ['read', 'write'] as const) {
    assert.throws(() => assertStoredWorkloadApiAccessAllowed({ scope: 'cluster', access }, {}), /not enabled/)
    assert.doesNotThrow(() => assertStoredWorkloadApiAccessAllowed({ scope: 'cluster', access }, enabled))
  }
})
