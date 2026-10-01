import test from 'node:test'
import assert from 'node:assert/strict'
import { assertExecAllocation } from './exec-ownership'
import { TrellisClient } from './trellis'
import type { TrellisAllocation } from '@/types/trellis'

test('namespace and ID remain mandatory even with matching labels and job names', () => {
  const allocation = { id: 'alloc', namespace: 'prod', job: 'web-green', labels: { 'bower/service': 'web' } } as unknown as TrellisAllocation
  assertExecAllocation([allocation], 'alloc', 'prod', 'web', 'web-green')
  assert.throws(() => assertExecAllocation([allocation], 'alloc', 'staging', 'web', 'web-green'))
  assert.throws(() => assertExecAllocation([allocation], 'other', 'prod', 'web', 'web-green'))
  assert.throws(() => assertExecAllocation([allocation], 'alloc', 'prod', 'worker', 'worker-green'))
  assertExecAllocation([{ ...allocation, labels: {} }], 'alloc', 'prod', 'web', 'web-green')
})

test('exec descriptor uses namespaced escaped URL, argv query, upgrade and server bearer', () => {
  const result = new TrellisClient('https://trellis.test', 'fixture-only').getExecConnection('a/b', 'prod east', 'web main', 93, 27)
  const url = new URL(result.url)
  assert.equal(url.pathname, '/v1/namespaces/prod%20east/allocations/a%2Fb/exec')
  assert.deepEqual([...url.searchParams], [['stdin', 'true'], ['tty', 'true'], ['term', 'xterm-256color'], ['cols', '93'], ['rows', '27'], ['command', '/bin/sh'], ['task', 'web main']])
  assert.deepEqual(result.headers, { Authorization: 'Bearer fixture-only' })
})
