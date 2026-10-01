import assert from 'node:assert/strict'
import test from 'node:test'
import { hasTrellisConnection, resolveTrellisConnection } from './trellis-connection'

const workloadOrg = {
  trellisApiUrl: 'https://stored.example.invalid',
  trellisApiToken: 'stored-token-must-not-be-used',
  useTrellisWorkloadIdentity: true,
}

test('workload organizations resolve each replica allocation credential and injected CA at runtime', () => {
  const first = resolveTrellisConnection(workloadOrg, {
    TRELLIS_ADDR: 'trellis:8128', TRELLIS_TOKEN: 'generation-one', TRELLIS_CA_CERT: 'first-ca',
  })
  const replacement = resolveTrellisConnection(workloadOrg, {
    TRELLIS_ADDR: 'trellis:8128', TRELLIS_TOKEN: 'generation-two', TRELLIS_CA_CERT: 'second-ca',
  })
  const otherReplica = resolveTrellisConnection(workloadOrg, {
    TRELLIS_ADDR: 'trellis:8128', TRELLIS_TOKEN: 'replica-two', TRELLIS_CA_CERT: 'first-ca',
  })

  assert.deepEqual(first, { apiUrl: 'trellis:8128', apiToken: 'generation-one', caCert: 'first-ca' })
  assert.deepEqual(replacement, { apiUrl: 'trellis:8128', apiToken: 'generation-two', caCert: 'second-ca' })
  assert.equal(otherReplica.apiToken, 'replica-two')
  assert.equal(workloadOrg.trellisApiToken, 'stored-token-must-not-be-used')
})

test('durable organization credentials ignore unrelated workload injection', () => {
  const durable = { trellisApiUrl: 'https://operator.example', trellisApiToken: 'operator-token', useTrellisWorkloadIdentity: false }
  const resolved = resolveTrellisConnection(durable, {
    TRELLIS_ADDR: 'trellis:8128', TRELLIS_TOKEN: 'allocation-token', TRELLIS_CA_CERT: 'allocation-ca',
  })
  assert.deepEqual(resolved, { apiUrl: 'https://operator.example', apiToken: 'operator-token' })
  assert.equal(hasTrellisConnection(durable, {}), true)
})

test('workload organizations fail closed when an allocation lacks complete injection', () => {
  assert.equal(hasTrellisConnection(workloadOrg, { TRELLIS_ADDR: 'trellis:8128' }), false)
  assert.throws(
    () => resolveTrellisConnection(workloadOrg, { TRELLIS_ADDR: 'trellis:8128' }),
    /were not injected/,
  )
})
