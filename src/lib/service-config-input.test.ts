import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDeploymentStrategy, parseKeyValueLines, parseResourceInputs, parseServiceConfigInput } from './service-config-input'
import { buildJobSpec } from './job-builder'

function form(values: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    image: ' nginx:alpine ', replicas: '1', resourceTier: 'custom', cpu: '175', memory: '1.25', strategy: 'rolling',
    ...values,
  })) data.set(key, value)
  return data
}

test('resource input boundaries use integral millicores and bytes, not rounded megabytes or zero defaults', () => {
  assert.deepEqual(parseResourceInputs('175', '1.25'), { cpu: 175, memory: 1_310_720 })
  assert.deepEqual(parseResourceInputs('10', '0.00000095367431640625'), { cpu: 10, memory: 1 })
  // Admission maxima belong to cluster policy, not a fixed Bower tier ceiling.
  assert.deepEqual(parseResourceInputs('1500', '1025'), { cpu: 1500, memory: 1_074_790_400 })
  for (const cpu of ['', '0', '1', '9', '-1', '0.5', '175.25', 'NaN', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseResourceInputs(cpu, '128'), /CPU/, cpu)
  }
  for (const memory of ['', '0', '-1', '0.0000001', '1.1', 'NaN', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseResourceInputs('175', memory), /Memory/, memory)
  }
})

test('validates replica counts and existing tier/strategy/health enums before saving', () => {
  for (const replicas of ['', '0', '-1', '1.5', 'Infinity']) assert.throws(() => parseServiceConfigInput(form({ replicas })), /Replicas/)
  for (const [key, value, error] of [
    ['resourceTier', 'unknown', /resource tier/], ['resourceTier', '__proto__', /resource tier/],
    ['strategy', 'rollng', /deployment strategy/], ['strategy', '', /deployment strategy/],
    ['healthType', 'udp', /health check type/], ['image', ' ', /image/],
  ] as const) assert.throws(() => parseServiceConfigInput(form({ [key]: value })), error)
  for (const strategy of ['rolling', 'recreate', 'blue_green', 'canary'] as const) assert.equal(parseDeploymentStrategy(strategy), strategy)
  const medium = parseServiceConfigInput(form({ resourceTier: 'medium', cpu: '0', memory: '0' }))
  assert.equal(medium.cpu, 250)
  assert.equal(medium.memory, 268_435_456)
})

test('enforces Trellis cluster admission resource limits when they are readable', () => {
  const limits = {
    max_replicas_per_task_group: 3, max_task_groups_per_job: 2, max_tasks_per_task_group: 2,
    max_desired_allocations: 2, max_desired_allocations_per_namespace: 5,
    default_task_cpu: 100, default_task_memory: 128, max_task_cpu: 500, max_task_memory: 2_000_000,
  }
  assert.equal(parseServiceConfigInput(form({ replicas: '2', cpu: '500', memory: '1' }), limits).replicas, 2)
  assert.throws(() => parseServiceConfigInput(form({ replicas: '3', cpu: '500', memory: '1' }), limits), /operator limit of 2/)
  assert.throws(() => parseServiceConfigInput(form({ replicas: '2', cpu: '501', memory: '1' }), limits), /CPU.*500/)
  assert.throws(() => parseServiceConfigInput(form({ replicas: '2', cpu: '500', memory: '2' }), limits), /Memory.*2000000/)
})

test('service configuration validates hidden workload JSON instead of asserting its types', () => {
  const config = parseServiceConfigInput(form({
    volumes: JSON.stringify([{ name: 'cache', container_path: '/cache', read_only: true }]),
    secretBindings: JSON.stringify([{ name: 'token', target: 'env', env: '_TOKEN' }]),
    canarySteps: JSON.stringify([5, 40, 100]),
  }))
  assert.deepEqual(config.volumes, [{ name: 'cache', container_path: '/cache', read_only: true }])
  assert.deepEqual(config.secretBindings, [{ name: 'token', target: 'env', env: '_TOKEN' }])
  assert.deepEqual(config.canarySteps, [5, 40, 100])
  for (const [key, value] of [
    ['volumes', { name: 'cache' }],
    ['secretBindings', [{ name: 'token', target: 'env', env: 42 }]],
    ['canarySteps', [50, 10, 100]],
  ] as const) assert.throws(() => parseServiceConfigInput(form({ [key]: JSON.stringify(value) })))
})

test('env and labels use distinct key rules and retain empty, Unicode, and equals-containing values', () => {
  assert.deepEqual(parseKeyValueLines(' _TOKEN2=a=b=c\nEMPTY=\nGREETING=mañana ', 'env'), {
    _TOKEN2: 'a=b=c', EMPTY: '', GREETING: 'mañana',
  })
  assert.deepEqual(parseKeyValueLines('team/owner.v2-x=ops=west\nEmpty=\nColor=青', 'label'), {
    'team/owner.v2-x': 'ops=west', Empty: '', Color: '青',
  })
  assert.deepEqual(parseKeyValueLines('__PROTO__=literal', 'env'), { ['__PROTO__']: 'literal' })
  for (const key of ['BAD-NAME', 'lowercase', '1route', 'team/owner', 'sp ace']) assert.throws(() => parseKeyValueLines(`${key}=v`, 'env'), /variable name/)
  for (const key of ['1route', '_team', 'sp ace', 'a'.repeat(64)]) assert.throws(() => parseKeyValueLines(`${key}=v`, 'label'), /label name/)
  assert.deepEqual(parseKeyValueLines(`${'a'.repeat(63)}=v`, 'label'), { ['a'.repeat(63)]: 'v' })
  for (const kind of ['env', 'label'] as const) {
    assert.throws(() => parseKeyValueLines('missing-equals', kind), /KEY=value/)
    assert.throws(() => parseKeyValueLines('=value', kind), /KEY=value/)
  }
})

test('service configuration accepts lossless JSON variables while retaining legacy line input', () => {
  const envVarsJson = JSON.stringify([
    { key: 'PADDED', value: '  value  ' },
    { key: 'MULTILINE', value: 'one\ntwo' },
    { key: 'EQUALS', value: 'a=b' },
  ])
  assert.deepEqual(parseServiceConfigInput(form({ envVarsJson })).envVars, {
    PADDED: '  value  ', MULTILINE: 'one\ntwo', EQUALS: 'a=b',
  })
  assert.deepEqual(parseServiceConfigInput(form({ envVars: 'LEGACY=value' })).envVars, { LEGACY: 'value' })
})

test('label value limits count Unicode code points, not bytes or UTF-16 units, without imposing env value limits', () => {
  assert.equal(parseKeyValueLines(`team=${'é'.repeat(256)}`, 'label').team, 'é'.repeat(256))
  assert.equal(parseKeyValueLines(`team=${'🌳'.repeat(256)}`, 'label').team, '🌳'.repeat(256))
  assert.equal(parseKeyValueLines(`team=${'a'.repeat(256)}`, 'label').team.length, 256)
  for (const value of ['é'.repeat(257), '🌳'.repeat(257), 'a'.repeat(257), 'e\u0301'.repeat(129)]) {
    assert.throws(() => parseKeyValueLines(`team=${value}`, 'label'), /256 Unicode code points/)
  }
  assert.equal(parseKeyValueLines(`LONG=${'é'.repeat(257)}`, 'env').LONG, 'é'.repeat(257))
  assert.throws(() => parseServiceConfigInput(form({ envVars: 'BAD-NAME=value' })), /variable name/)
  assert.throws(() => parseServiceConfigInput(form({ labels: '1route=value' })), /label name/)
})

test('HTTP and TCP ports require integers within both boundaries', () => {
  for (const healthType of ['http', 'tcp']) {
    for (const healthPort of ['1', '65535']) assert.equal(parseServiceConfigInput(form({ healthType, healthPort })).healthCheckPort, Number(healthPort))
    for (const healthPort of ['', '0', '-1', '65536', '1.5', 'NaN', 'Infinity']) {
      assert.throws(() => parseServiceConfigInput(form({ healthType, healthPort })), /port/)
    }
  }
})

test('HTTP paths accept encoded path/query targets, and reject malformed targets and length overflow', () => {
  const http = { healthType: 'http', healthPort: '8081' }
  for (const healthPath of ['', '/', '/ready?tenant=a%20b&check=2', `/${'a'.repeat(1023)}`]) {
    assert.equal(parseServiceConfigInput(form({ ...http, healthPath })).healthCheckPath, healthPath || null)
  }
  for (const healthPath of ['ready', 'http://host/ready', '/a b', '/ready#fragment', '/%', '/%2', '/%GG', '/café', `/${'a'.repeat(1024)}`]) {
    assert.throws(() => parseServiceConfigInput(form({ ...http, healthPath })), /path/)
  }
})

test('health timings and thresholds default only when omitted or blank, never for explicit zero or invalid values', () => {
  for (const blank of [undefined, '']) {
    const values: Record<string, string> = blank === undefined ? {} : { healthInterval: blank, healthTimeout: blank, healthThreshold: blank }
    const config = parseServiceConfigInput(form(values))
    assert.equal(config.healthCheckInterval, 10)
    assert.equal(config.healthCheckTimeout, 2)
    assert.equal(config.healthCheckThreshold, 3)
  }
  for (const key of ['healthInterval', 'healthTimeout', 'healthThreshold']) {
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity']) assert.throws(() => parseServiceConfigInput(form({ [key]: value })), /positive integer/)
  }
  assert.equal(parseServiceConfigInput(form({ healthInterval: '1', healthTimeout: '1', healthThreshold: '1' })).healthCheckThreshold, 1)
  for (const key of ['healthInterval', 'healthTimeout']) {
    assert.equal(parseServiceConfigInput(form({ [key]: '9223372036' }))[key === 'healthInterval' ? 'healthCheckInterval' : 'healthCheckTimeout'], 9_223_372_036)
    assert.throws(() => parseServiceConfigInput(form({ [key]: '9223372037' })), /nanosecond range/)
  }
})

test('script health checks need a command and disabled health checks remain disabled', () => {
  assert.throws(() => parseServiceConfigInput(form({ healthType: 'script', healthCommand: '  ' })), /command/)
  const config = parseServiceConfigInput(form({ healthType: 'script', healthCommand: '/bin/check --ready now' }))
  assert.deepEqual(config.healthCheckCommand, ['/bin/check', '--ready', 'now'])
  assert.equal(config.healthCheckPort, null)
  assert.equal(parseServiceConfigInput(form()).healthCheckType, null)
})

test('validated asymmetric form inputs produce canonical resources, nanoseconds, labels, and count-1 rolling', () => {
  const input = parseServiceConfigInput(form({
    healthType: 'http', healthPort: '8081', healthPath: '/ready?mode=full',
    healthInterval: '17', healthTimeout: '4', healthThreshold: '2',
    envVars: '_MODE=canary=trial', labels: 'team/owner=west',
  }))
  const group = buildJobSpec({
    ...input, name: 'api', namespace: 'shop-production', secrets: input.secretBindings, volumes: [],
    healthCheckType: input.healthCheckType ?? undefined, healthCheckPort: input.healthCheckPort ?? undefined,
    healthCheckPath: input.healthCheckPath ?? undefined,
  }).task_groups[0]
  assert.equal(group.count, 1)
  assert.deepEqual(group.update, { strategy: 'rolling', max_parallel: 1 })
  assert.deepEqual(group.labels, { 'team/owner': 'west', 'bower/managed': 'true', 'bower/service': 'api' })
  assert.equal(group.tasks[0].image, 'docker.io/library/nginx:alpine')
  assert.deepEqual(group.tasks[0].resources, { cpu: 175, memory: 1_310_720 })
  assert.deepEqual(group.tasks[0].env, { _MODE: 'canary=trial' })
  assert.deepEqual(group.tasks[0].health_check, { type: 'http', port: 8081, path: '/ready?mode=full', interval: 17_000_000_000, timeout: 4_000_000_000, threshold: 2 })
})
