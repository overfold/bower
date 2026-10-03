import assert from 'node:assert/strict'
import test from 'node:test'
import { latestFailedDeployments } from './needs-attention'

const now = Date.parse('2026-10-03T12:00:00Z')
const row = (id: string, status: string, age: number, serviceId = 'a') => ({ deployment: { id, serviceId, status, createdAt: new Date(now - age) }, serviceName: serviceId, projectSlug: 'commerce' })
test('fail → succeed disappears, even with unsorted input', () => {
  assert.deepEqual(latestFailedDeployments([row('success', 'healthy', 1000), row('failure', 'failed', 2000)], now), [])
})
test('succeed → fail shows latest failure', () => {
  assert.deepEqual(latestFailedDeployments([row('success', 'healthy', 2000), row('failure', 'failed', 1000)], now).map((r) => r.deployment.id), ['failure'])
})
test('fail → fail shows once per service and respects 24-hour boundary', () => {
  assert.deepEqual(latestFailedDeployments([row('old', 'failed', 3000), row('new', 'failed', 1000), row('boundary', 'failed', 86_400_000, 'b'), row('expired', 'failed', 86_400_001, 'c')], now).map((r) => r.deployment.id), ['new', 'boundary'])
})
