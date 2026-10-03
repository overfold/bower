import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVariableMatrix, removeServiceVariable, setServiceBinding, setServiceValue } from './variable-matrix'

test('builds inherited, overridden, and display-name secret cells', () => {
  const rows = buildVariableMatrix(['API_URL'], [{
    id: '1', name: 'Web', envVars: { LOG_LEVEL: 'debug' },
    secretBindings: [{ name: 'database-url-internal', target: 'env', env: 'DATABASE_URL' }],
  }], { 'database-url-internal': 'Production database' })
  assert.deepEqual(rows, [
    { key: 'API_URL', shared: 'write-only', services: [{ kind: 'inherited' }] },
    { key: 'DATABASE_URL', shared: 'empty', services: [{ kind: 'secret', secretName: 'database-url-internal', displayName: 'Production database', target: 'env' }] },
    { key: 'LOG_LEVEL', shared: 'empty', services: [{ kind: 'value', value: 'debug' }] },
  ])
})

test('shared cells expose only write-only availability and inherited cells contain no value', () => {
  const [row] = buildVariableMatrix(['TOKEN'], [{ id: '1', name: 'Web', envVars: {}, secretBindings: [] }], {})
  assert.equal(row.shared, 'write-only')
  assert.deepEqual(row.services[0], { kind: 'inherited' })
  assert.equal('value' in row.services[0], false)
})

test('service mutations replace values and bindings at env and file destinations', () => {
  const service = {
    id: '1', name: 'Web', envVars: { TOKEN: 'plain', KEEP: 'yes' },
    secretBindings: [{ name: 'cert', target: 'file' as const, path: '/run/cert' }],
  }
  const bound = setServiceBinding(service, { name: 'token-secret', target: 'env', env: 'TOKEN' }, 'TOKEN')
  assert.deepEqual(bound.envVars, { KEEP: 'yes' })
  assert.deepEqual(bound.secretBindings, [
    { name: 'cert', target: 'file', path: '/run/cert' },
    { name: 'token-secret', target: 'env', env: 'TOKEN' },
  ])
  const valued = setServiceValue(bound, 'CERT_PATH', '/tmp/cert', '/run/cert')
  assert.deepEqual(valued.envVars, { KEEP: 'yes', CERT_PATH: '/tmp/cert' })
  assert.deepEqual(valued.secretBindings, [{ name: 'token-secret', target: 'env', env: 'TOKEN' }])
  assert.deepEqual(removeServiceVariable(valued, 'TOKEN').secretBindings, [])
})
