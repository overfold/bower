import assert from 'node:assert/strict'
import test from 'node:test'
import { redactAuditDetails, routeAuditState, serviceConfigAuditState } from './audit-details'

test('recursive redaction removes unchanged credential/config values while retaining resource metadata', () => {
  const before = { domain: 'app.test', passwordHash: 'SENSITIVE_HASH', headers: { Authorization: 'SENSITIVE_HEADER', 'X-Custom': 'SENSITIVE_CUSTOM' }, responseHeaders: { 'Set-Cookie': 'SENSITIVE_COOKIE' }, envVars: { DATABASE_URL: 'SENSITIVE_DB' }, labels: { custom: 'SENSITIVE_LABEL' }, overrides: { healthCheckCommand: ['SENSITIVE_COMMAND'] } }
  const input = { before, after: before, environmentId: 'env', environmentName: 'Production', serviceName: 'Web' }
  const sanitized = redactAuditDetails(input)
  assert.doesNotMatch(JSON.stringify(sanitized), /SENSITIVE/)
  assert.equal(sanitized.environmentName, 'Production')
  assert.equal((sanitized.before as typeof before).domain, 'app.test')
  assert.equal(before.passwordHash, 'SENSITIVE_HASH')
  assert.deepEqual(redactAuditDetails(sanitized), sanitized)
})

test('explicit audit states exclude sensitive and unknown full-row fields and survive historical reprocessing', () => {
  const route = routeAuditState({ domain: 'app.test', port: 9000, protectionMode: 'password', passwordHash: 'SENSITIVE_HASH', headers: { Authorization: 'SENSITIVE_HEADER' }, redirects: [{ to: 'https://x/?token=SENSITIVE_TOKEN' }], unexpected: 'SENSITIVE_UNKNOWN' })
  assert.doesNotMatch(JSON.stringify(route), /SENSITIVE/)
  assert.equal(route.port, 9000)
  assert.deepEqual(route.requestHeaderNames, ['Authorization'])
  assert.equal(route.redirectCount, 1)
  assert.deepEqual(routeAuditState(route), route)
  const config = serviceConfigAuditState({ image: 'app:v3', replicas: 3, envVars: { DATABASE_URL: 'SENSITIVE_DB' }, labels: { foo: 'SENSITIVE_LABEL' }, healthCheckPath: '/?key=SENSITIVE_KEY', healthCheckCommand: ['SENSITIVE_COMMAND'], unexpected: 'SENSITIVE_UNKNOWN' })!
  assert.doesNotMatch(JSON.stringify(config), /SENSITIVE/)
  assert.equal(config.replicas, 3)
  assert.deepEqual(config.environmentVariableNames, ['DATABASE_URL'])
  assert.deepEqual(serviceConfigAuditState(config), config)
})
