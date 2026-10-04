import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as bodyHelpers from './request-body'
import * as filters from './webhook-filter'

// Execute the real handlers, replacing only database/auth/deployment I/O.
function load(path: string, dependencies: Record<string, unknown>): { POST: (request: Request, context?: unknown) => Promise<Response> } {
  const filename = resolve(path); const require = createRequire(filename); const loaded = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } })
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, Request, Response, URL, Buffer, Uint8Array,
    require: (name: string) => name in dependencies ? dependencies[name] : require(name.startsWith('@/') ? resolve('src', name.slice(2)) : name),
  }, { filename })
  return loaded.exports as ReturnType<typeof load>
}

function query(rows: unknown[]) {
  return { from() { return this }, where() { return this }, limit: async () => rows }
}

function request(body: string | Buffer, headers: HeadersInit = {}, chunked = false) {
  return new Request('https://bower.test/api', {
    method: 'POST', headers,
    body: chunked ? new ReadableStream({ start(c) { const bytes = Buffer.from(body); c.enqueue(bytes.subarray(0, 37)); c.enqueue(bytes.subarray(37)); c.close() } }) : body,
    duplex: 'half',
  } as RequestInit)
}

test('webhook rejects unknown tokens before reads, preserves raw HMAC, bounds declared/chunked bodies and safely filters adversarial tags', async () => {
  let hook: unknown = null; const deployed: unknown[][] = []
  const route = load('src/app/api/webhooks/[token]/route.ts', {
    '@/db': { db: { select: () => query(hook ? [hook] : []) } },
    '@/lib/actions/services': { deployServiceFromAutomation: async (...args: unknown[]) => { deployed.push(args); return { deployment: { id: 'deployment-7' } } } },
    '@/lib/request-body': bodyHelpers, '@/lib/webhook-filter': filters,
  })
  const context = { params: Promise.resolve({ token: 'different-secret' }) }
  const unknown = request('x'.repeat(100000))
  assert.equal((await route.POST(unknown, context)).status, 404)
  assert.equal(unknown.bodyUsed, false)
  hook = { isActive: true, provider: 'generic', serviceId: 'svc-3', environmentId: 'env-8', deployMode: 'tag', tagFilter: '^v[0-9]+\\.[0-9]+$' }
  const raw = '{ "image": "team/app:v12.3", "note": "é λ" }\r\n'
  // Independent OpenSSL vector: raw whitespace, non-ASCII and CRLF are signed.
  const signature = '861d62726161afb40c08814b8b7fe7eeb0df3689fd07be75464ac291243bed01'
  const valid = await route.POST(request(raw, { 'x-bower-signature': `sha256=${signature}` }, true), context)
  assert.equal(valid.status, 202)
  assert.deepEqual(await valid.json(), { accepted: true, deploymentId: 'deployment-7' })
  assert.deepEqual(deployed[0].slice(0, 3), ['svc-3', 'env-8', 'team/app:v12.3'])
  assert.equal((await route.POST(request(raw.trim(), { 'x-bower-signature': signature }), context)).status, 401)
  for (const chunked of [false, true]) {
    assert.equal((await route.POST(request('x'.repeat(bodyHelpers.BODY_LIMITS.webhook + 1), { 'x-bower-signature': signature, ...(!chunked ? { 'content-length': String(bodyHelpers.BODY_LIMITS.webhook + 1) } : {}) }, chunked), context)).status, 413)
  }
  const signed = (raw: string) => request(raw, { 'x-bower-signature': createHmac('sha256', 'different-secret').update(raw).digest('hex') })
  assert.equal((await route.POST(signed('{'), context)).status, 400)
  assert.equal((await route.POST(signed('null'), context)).status, 400)
  hook = { ...(hook as object), tagFilter: '^(a+)+$' }
  // Maximum adversarial input is isolated in webhook-filter.test.ts so even
  // a regression to backtracking cannot hang the shared test process.
  assert.deepEqual(await (await route.POST(signed(JSON.stringify({ image: `team/app:${'a'.repeat(20)}!` })), context)).json(), { ignored: true, reason: 'tag did not match' })
  hook = { ...(hook as object), tagFilter: '(a)\\1' }
  assert.deepEqual(await (await route.POST(signed('{"image":"team/app:aa"}'), context)).json(), { ignored: true, reason: 'tag did not match' })
  assert.equal(deployed.length, 1)
})

test('deploy authenticates before reads, enforces body limits and validates malformed bodies without deploying', async () => {
  let authenticated = false; let deployments = 0
  const route = load('src/app/api/deploy/route.ts', {
    '@/lib/api-auth': { authenticateApiKeyToken: async () => authenticated ? {} : null, authenticateApiKey: async (_: unknown, serviceId: string) => serviceId === 'service-7' ? { project: { id: 'project-3' }, actor: { actorType: 'api_key' } } : null },
    '@/db': { db: { select: () => query([{ id: 'environment-9' }]) } },
    '@/lib/actions/services': { deployServiceFromAutomation: async (...args: unknown[]) => { deployments++; assert.deepEqual(args.slice(0, 3), ['service-7', 'environment-9', 'app:v3']); return { deployment: { id: 'deployment-5' } } } },
    '@/lib/request-body': bodyHelpers,
  })
  const anonymous = request('x'.repeat(100000))
  assert.equal((await route.POST(anonymous)).status, 401); assert.equal(anonymous.bodyUsed, false)
  authenticated = true
  for (const chunked of [false, true]) assert.equal((await route.POST(request('x'.repeat(8193), chunked ? {} : { 'content-length': '8193' }, chunked))).status, 413)
  for (const malformed of ['{', 'null', '{"serviceId":123}', '[]']) assert.equal((await route.POST(request(malformed))).status, 400)
  assert.equal(deployments, 0)
  assert.equal((await route.POST(request('{"serviceId":"service-7","environmentId":"environment-9","image":"app:v3"}', {}, true))).status, 202)
  assert.equal(deployments, 1)
})

test('password handler bounds forms and rejects shared rate/concurrency admission before bcrypt or grant issuance', async () => {
  class Busy extends Error {}
  let allowed = false; let workBusy = false; let valid = false; let compares = 0; let grants = 0
  const route = load('src/app/api/route-auth/password/route.ts', {
    '@/lib/request-body': bodyHelpers,
    '@/lib/auth-abuse': { consumeAuthAttempt: async (headers: Headers, scope: string) => { assert.equal(headers.get('x-test-source'), 'source-1'); assert.equal(scope, 'route-password:route-9'); return allowed } },
    '@/lib/auth': { PasswordWorkBusyError: Busy, verifyPassword: async (password: string, hash: string) => { compares++; assert.equal(password, 'asymmetric-secret'); assert.equal(hash, 'fixture-hash'); if (workBusy) throw new Busy(); return valid } },
    '@/lib/route-auth': { getProtectedRoute: async () => ({ protectionMode: 'password', passwordHash: 'fixture-hash' }), routeMatchesUrl: (_: unknown, url: URL) => url.hostname === 'app.test', createPasswordRouteHandoff: (id: string, target: string) => { grants++; assert.equal(id, 'route-9'); assert.equal(target, 'https://app.test/branch?x=3'); return 'handoff-fixture' } },
  })
  const headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-test-source': 'source-1' }
  const form = new URLSearchParams({ route: 'route-9', returnTo: 'https://app.test/branch?x=3', password: 'asymmetric-secret' }).toString()
  for (const chunked of [false, true]) assert.equal((await route.POST(request('x'.repeat(8193), { ...headers, ...(!chunked ? { 'content-length': '8193' } : {}) }, chunked))).status, 413)
  assert.equal((await route.POST(request('garbage', { 'content-type': 'multipart/form-data; boundary=missing' }))).status, 400)
  assert.equal((await route.POST(request(form, headers))).status, 429); assert.equal(compares, 0)
  allowed = true; workBusy = true
  assert.equal((await route.POST(request(form, headers))).status, 429); assert.equal(grants, 0)
  workBusy = false
  const denied = await route.POST(request(form, headers)); assert.equal(denied.status, 303); assert.match(denied.headers.get('location') || '', /error=invalid-password/)
  valid = true
  const accepted = await route.POST(request(form, headers, true)); assert.equal(accepted.status, 303)
  assert.equal(accepted.headers.get('location'), 'https://app.test/.bower/auth/callback?token=handoff-fixture'); assert.equal(grants, 1)
})
