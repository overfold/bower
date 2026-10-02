import assert from 'node:assert/strict'
import test from 'node:test'
import { parseEnvironmentVariableRows } from './environment-variable-input'

test('normalizes and validates environment variable rows', () => {
  assert.deepEqual(parseEnvironmentVariableRows('[{"key":" api_url ","value":"x=y"}]'), [{ key: 'API_URL', value: 'x=y' }])
  assert.throws(() => parseEnvironmentVariableRows('[{"key":"1BAD","value":"x"}]'), /Invalid environment variable name/)
  assert.throws(() => parseEnvironmentVariableRows('[{"key":"A","value":"1"},{"key":"a","value":"2"}]'), /Duplicate/)
  assert.throws(() => parseEnvironmentVariableRows('{}'), /must be a list/)
})
