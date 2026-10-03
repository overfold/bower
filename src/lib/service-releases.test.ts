import assert from 'node:assert/strict'
import test from 'node:test'
import { earlierSuccessfulReleases, runningRelease } from './service-releases'

const release = (id: string, status: string, version: number, revision = version) => ({ id, status, trellisJobName: 'web', trellisVersion: version, trellisRevision: revision, jobSpec: {} })

test('uses runtime identity and never offers the live release after a newer failure or rollback', () => {
  const journal = [release('failed-new', 'failed', 4), release('live-rollback', 'healthy', 2), release('old', 'healthy', 1)]
  const active = runningRelease(journal, { name: 'web', version: 2, revision: 2 })
  assert.equal(active?.id, 'live-rollback')
  assert.deepEqual(earlierSuccessfulReleases(journal, active).map((item) => item.id), ['old'])
  assert.deepEqual(earlierSuccessfulReleases(journal, undefined), [])
})
