import assert from 'node:assert/strict'
import test from 'node:test'
import { planIncidentSync } from './service-incidents'

const now = new Date('2026-10-03T12:00:00Z')
const at = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

test('a newly failing service opens one incident that starts when the failure began', () => {
  const plan = planIncidentSync({ failing: [{ serviceId: 's1', environmentId: 'e1', since: at(7), cause: 'Worker could not reach database' }], healthy: [], open: [], now })
  assert.equal(plan.opens.length, 1)
  assert.equal(plan.opens[0].since.getTime(), at(7).getTime())
  assert.deepEqual(plan.touches, [])
  assert.deepEqual(plan.resolves, [])
})

test('a service that keeps failing keeps its incident and original start (no repeat notification)', () => {
  const plan = planIncidentSync({
    failing: [{ serviceId: 's1', environmentId: 'e1', since: at(1), cause: 'new cause' }],
    healthy: [], open: [{ id: 'i1', serviceId: 's1', environmentId: 'e1', startedAt: at(90), cause: 'old cause' }], now,
  })
  assert.deepEqual(plan.opens, [])
  assert.deepEqual(plan.touches, [{ id: 'i1', cause: 'new cause' }])
})

test('an incident resolves only when the service was observed healthy, never because it could not be observed', () => {
  const open = [{ id: 'i1', serviceId: 's1', environmentId: 'e1', startedAt: at(90), cause: 'x' }, { id: 'i2', serviceId: 's2', environmentId: 'e1', startedAt: at(90), cause: 'x' }]
  const plan = planIncidentSync({ failing: [], healthy: [{ serviceId: 's1', environmentId: 'e1' }], open, now })
  assert.deepEqual(plan.resolves, ['i1'])
})

test('a future failure time is clamped to now', () => {
  const plan = planIncidentSync({ failing: [{ serviceId: 's1', environmentId: 'e1', since: new Date(now.getTime() + 60_000), cause: 'x' }], healthy: [], open: [], now })
  assert.equal(plan.opens[0].since.getTime(), now.getTime())
})
