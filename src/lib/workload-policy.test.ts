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

test('default tenant policy allows managed paths and namespace read but denies host and mutating/cluster grants', () => {
  assert.doesNotThrow(() => assertHostPathAllowed('@/project/data', false, {}))
  assert.throws(() => assertHostPathAllowed('/srv/data', false, enabled), /instance admin/)
  assert.throws(() => assertHostPathAllowed('/srv/data', true, {}), /BOWER_IA_BYPASS/)
  assert.doesNotThrow(() => assertWorkloadApiAccessAllowed(undefined, false, {}))
  assert.doesNotThrow(() => assertWorkloadApiAccessAllowed({ scope: 'namespace', access: 'read' }, false, {}))
  for (const access of [
    { scope: 'namespace', access: 'write' },
    { scope: 'cluster', access: 'read' },
    { scope: 'cluster', access: 'write' },
  ] as const) assert.throws(() => assertWorkloadApiAccessAllowed(access, false, enabled), /instance admin/)
})

test('instance admin with bypass enabled may configure privileged capabilities', () => {
  assert.doesNotThrow(() => assertHostPathAllowed('/srv/data', true, enabled))
  assert.doesNotThrow(() => assertWorkloadApiAccessAllowed({ scope: 'cluster', access: 'write' }, true, enabled))
})

test('deployment permits stored privileged capabilities only while the operator bypass remains enabled', () => {
  assert.throws(() => assertStoredHostPathAllowed('/srv/data', {}), /not enabled/)
  assert.throws(() => assertStoredWorkloadApiAccessAllowed({ scope: 'namespace', access: 'write' }, {}), /not enabled/)
  assert.doesNotThrow(() => assertStoredHostPathAllowed('/srv/data', enabled))
  assert.doesNotThrow(() => assertStoredWorkloadApiAccessAllowed({ scope: 'cluster', access: 'write' }, enabled))
})
