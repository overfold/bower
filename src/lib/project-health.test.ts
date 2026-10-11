import assert from 'node:assert/strict'
import test from 'node:test'
import { projectHealth } from './project-health'

test('project health reflects live services, including unavailable observations', () => {
  assert.deepEqual(projectHealth([]), { label: 'No services', tone: 'neutral' })
  assert.deepEqual(projectHealth([{ health: 'healthy' }]), { label: 'Healthy', tone: 'success' })
  assert.deepEqual(projectHealth([{ health: 'healthy' }, { health: 'failing' }, { health: 'unknown' }]), { label: '2 of 3 failing', tone: 'danger' })
})
