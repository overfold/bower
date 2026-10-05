import assert from 'node:assert/strict'
import test from 'node:test'
import { earlierSuccessfulReleases, releaseImagePins, runningRelease } from './service-releases'

const release = (id: string, status: string, version: number, revision = version) => ({
  id, status, trellisJobName: 'web', trellisIncarnation: 'inc-live', trellisVersion: version, trellisRevision: revision,
  jobSpec: { task_groups: [{ tasks: [{ image: 'app:mutable' }] }] },
  planDiff: { resolved_images: { 'app:mutable': `app@sha256:release${version}` } },
})

test('uses runtime identity and never offers the live release after a newer failure or rollback', () => {
  const journal = [release('failed-new', 'failed', 4), release('live-rollback', 'healthy', 2), release('old', 'healthy', 1)]
  const active = runningRelease(journal, { name: 'web', version: 2, revision: 2 })
  assert.equal(active?.id, 'live-rollback')
  assert.deepEqual(earlierSuccessfulReleases(journal, active).map((item) => item.id), ['old'])
  assert.deepEqual(earlierSuccessfulReleases(journal, undefined), [])
})

test('recreated track identities and missing pins never become rollback targets', () => {
  const current = release('current', 'healthy', 2)
  const stale = { ...current, id: 'deleted-incarnation', trellisIncarnation: 'inc-old' }
  const unpinned = { ...release('unpinned', 'healthy', 1), planDiff: null }
  const oldTrack = { ...release('blue', 'healthy', 1), trellisJobName: 'web-blue', trellisIncarnation: 'inc-blue' }
  const journal = [stale, current, unpinned, oldTrack]
  const active = runningRelease(journal, { name: 'web', incarnation: 'inc-live', version: 2, revision: 2 })
  assert.equal(active?.id, 'current')
  assert.deepEqual(earlierSuccessfulReleases(journal, active).map((item) => item.id), ['blue'])
})

test('image pins cover every task; immutable authored digests need no stored plan', () => {
  const spec = { task_groups: [{ tasks: [{ image: 'app:mutable' }, { image: 'sidecar:mutable' }] }] }
  assert.equal(releaseImagePins(spec, { resolved_images: { 'app:mutable': 'app@sha256:old' } }), undefined)
  assert.deepEqual(releaseImagePins(spec, { resolved_images: { 'app:mutable': 'app@sha256:old', 'sidecar:mutable': 'sidecar@sha256:other' } }), {
    'app:mutable': 'app@sha256:old', 'sidecar:mutable': 'sidecar@sha256:other',
  })
  assert.deepEqual(releaseImagePins({ task_groups: [{ tasks: [{ image: 'app@sha256:fixed' }] }] }, null), { 'app@sha256:fixed': 'app@sha256:fixed' })
})
