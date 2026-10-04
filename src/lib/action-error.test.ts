import assert from 'node:assert/strict'
import test from 'node:test'
import { ActionError, actionErrorMessage } from './action-error'

test('hides messages from digested server action errors', () => {
  const error = Object.assign(new Error('Minified React error #441; sensitive detail'), { digest: '12345' })
  assert.equal(actionErrorMessage(error, 'Could not save.'), 'Could not save.')
})

test('preserves ordinary validation error messages', () => {
  assert.equal(actionErrorMessage(new Error('Name is required.'), 'Could not save.'), 'Name is required.')
})

test('uses the fallback for unknown thrown values', () => {
  assert.equal(actionErrorMessage({ message: 'not trusted' }, 'Could not save.'), 'Could not save.')
})

test('action errors are ordinary errors whose message is meant for the user', () => {
  const error = new ActionError('Insufficient permissions.')
  assert.ok(error instanceof Error)
  assert.equal(actionErrorMessage(error, 'Could not save.'), 'Insufficient permissions.')
})
