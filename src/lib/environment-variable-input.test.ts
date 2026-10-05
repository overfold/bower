import assert from 'node:assert/strict'
import test from 'node:test'
import { environmentVariableRecord, parseEnvironmentVariableRows, parseEnvText, validateServiceVariableConflicts } from './environment-variable-input'

test('normalizes and validates environment variable rows', () => {
  assert.deepEqual(parseEnvironmentVariableRows('[{"key":" api_url ","value":"x=y"}]'), [{ key: 'API_URL', value: 'x=y' }])
  assert.throws(() => parseEnvironmentVariableRows('[{"key":"1BAD","value":"x"}]'), /Invalid environment variable name/)
  assert.throws(() => parseEnvironmentVariableRows('[{"key":"A","value":"1"},{"key":"a","value":"2"}]'), /Duplicate/)
  assert.throws(() => parseEnvironmentVariableRows('{}'), /must be a list/)
})

test('service variable JSON preserves values losslessly and rejects duplicate or invalid names', () => {
  assert.deepEqual(environmentVariableRecord(JSON.stringify([
    { key: ' PADDED ', value: '  kept  ' },
    { key: 'MULTILINE', value: 'first\nsecond' },
    { key: 'EQUALS', value: 'a=b=c' },
  ])), { PADDED: '  kept  ', MULTILINE: 'first\nsecond', EQUALS: 'a=b=c' })
  assert.throws(() => environmentVariableRecord('[{"key":"A","value":"1"},{"key":"a","value":"2"}]'), /Duplicate/)
  assert.throws(() => environmentVariableRecord('[{"key":"bad-name","value":"x"}]'), /Invalid/)
})

test('.env paste parsing preserves value whitespace after the separator', () => {
  assert.deepEqual(parseEnvText('  export PADDED=  value  \n# ignored\nEQUALS=a=b  '), [
    { key: 'PADDED', value: '  value  ' },
    { key: 'EQUALS', value: 'a=b  ' },
  ])
})

test('service variables reject plain, secret-target, shared-secret, and unavailable-secret conflicts', () => {
  const validate = (envVars: Record<string, string>, bindings: Parameters<typeof validateServiceVariableConflicts>[1], shared = { SHARED: 'shared-secret' }, available = new Set(['token'])) =>
    validateServiceVariableConflicts(envVars, bindings, shared, available, 'Production')
  assert.throws(() => validate({ SHARED: 'plain' }, []), /already defined/)
  assert.throws(() => validate({ TOKEN: 'plain' }, [{ name: 'token', target: 'env', env: 'TOKEN' }]), /service variable/)
  assert.throws(() => validate({}, [{ name: 'token', target: 'env', env: 'SHARED' }]), /environment/)
  assert.throws(() => validate({}, [{ name: 'shared-secret', target: 'file', path: '/secret' }], { SHARED: 'shared-secret' }, new Set(['shared-secret'])), /already injected/)
  assert.throws(() => validate({}, [{ name: 'missing', target: 'env', env: 'TOKEN' }]), /does not exist in Production/)
})
