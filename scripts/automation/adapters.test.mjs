import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { createClient } from './client.mjs'

const serviceId = '10000000-0000-4000-8000-000000000001'
const environmentId = '20000000-0000-4000-8000-000000000002'
const projectId = '30000000-0000-4000-8000-000000000003'
const targetDeploymentId = '40000000-0000-4000-8000-000000000004'
const service = { serviceId, environmentId }
const cases = {
  projects: {}, environments: { projectId }, services: { projectId },
  deployments: service, allocations: service,
  logs: { ...service, allocationId: 'allocation/one?x&=λ', task: 'worker' },
  metrics: { ...service, allocationId: 'allocation-two' },
  deploy: { ...service, image: 'ghcr.io/example/app:v7', confirm: true },
  restart: { ...service, confirm: true },
  rollback: { ...service, targetDeploymentId, confirm: true },
}

test('CLI and MCP expose the application contracts over authenticated HTTP, with explicit write opt-in', async (t) => {
  let status = 200, requests = 0
  const server = createServer(async (req, res) => {
    requests++
    assert.equal(req.headers.authorization, 'Bearer synthetic-test-token')
    const url = new URL(req.url, 'http://local.test')
    assert.equal(url.pathname, '/api/v1/automation')
    let body = ''; for await (const chunk of req) body += chunk
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(status, status === 302 ? { location: '/should-not-follow' } : {})
    res.end(JSON.stringify(status === 200 ? { method: req.method, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null } : { error: 'Scope denied.' }))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  const env = { BOWER_URL: `http://127.0.0.1:${server.address().port}`, BOWER_TOKEN: 'synthetic-test-token' }
  const cli = async (args, config = env) => {
    try { return { code: 0, ...await promisify(execFile)(process.execPath, ['scripts/automation/cli.mjs', ...args], { env: { ...process.env, ...config } }) } }
    catch (error) { return { code: error.code, stdout: error.stdout, stderr: error.stderr } }
  }
  const help = await cli(['--help'], { BOWER_URL: '', BOWER_TOKEN: '' })
  assert.equal(help.code, 0); assert.match(help.stdout, /target-deployment-id/)
  for (const [operation, input] of Object.entries(cases)) {
    const args = Object.entries(input).flatMap(([key, value]) => [`--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, ...(value === true ? [] : [value])])
    const result = await cli([operation, ...args])
    assert.equal(result.code, 0, result.stderr)
    const response = JSON.parse(result.stdout)
    const write = ['deploy', 'restart', 'rollback'].includes(operation)
    assert.equal(response.method, write ? operation === 'deploy' ? 'POST' : 'PATCH' : 'GET')
    const expected = { ...input }
    delete expected.confirm
    assert.deepEqual(write ? response.body : response.query, write && operation === 'deploy' ? expected : { operation, ...expected })
    assert.equal(result.stderr, '')
  }
  const beforeInvalid = requests
  for (const args of [['restart', '--service-id', serviceId, '--environment-id', environmentId], ['projects', '--image', 'unexpected'], ['metrics'], ['rollback', '--confirm']]) {
    const result = await cli(args)
    assert.equal(result.code, 1); assert.equal(result.stdout, ''); assert.doesNotMatch(result.stderr, /synthetic-test-token/)
  }
  assert.equal(requests, beforeInvalid, 'invalid or unconfirmed CLI operations never reach Bower')
  for (const url of ['http://remote.example', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test?token=x']) {
    assert.throws(() => createClient({ ...env, BOWER_URL: url }), /HTTPS origin/)
  }
  for (const allowWrites of [false, true]) {
    const client = new Client({ name: 'bower-test', version: '1.0.0' })
    const transport = new StdioClientTransport({ command: process.execPath, args: ['scripts/automation/mcp.mjs'], env: { ...env, BOWER_ALLOW_WRITES: allowWrites ? '1' : '0' }, stderr: 'pipe' })
    try {
      await client.connect(transport)
      const { tools } = await client.listTools()
      assert.deepEqual(tools.map(tool => tool.name).sort(), Object.keys(cases).filter(name => allowWrites || !['deploy', 'restart', 'rollback'].includes(name)).map(name => `bower_${name}`).sort())
      for (const tool of tools) {
        const operation = tool.name.slice(6)
        assert.equal(tool.annotations.readOnlyHint, !['deploy', 'restart', 'rollback'].includes(operation))
        const result = await client.callTool({ name: tool.name, arguments: cases[operation] })
        assert.equal(result.isError, undefined, JSON.stringify(result.content))
        const expected = { ...cases[operation] }
        delete expected.confirm
        assert.deepEqual(result.structuredContent.method === 'GET' ? result.structuredContent.query : result.structuredContent.body, operation === 'deploy' ? expected : { operation, ...expected })
      }
      const beforeInvalid = requests
      const invalid = await client.callTool({ name: 'bower_logs', arguments: { ...service, allocationId: 'x', namespace: 'foreign' } })
      assert.equal(invalid.isError, true)
      if (allowWrites) {
        const unconfirmed = await client.callTool({ name: 'bower_restart', arguments: service })
        assert.equal(unconfirmed.isError, true)
      }
      assert.equal(requests, beforeInvalid)
      status = 403
      const denied = await client.callTool({ name: 'bower_projects', arguments: {} })
      assert.equal(denied.isError, true)
      assert.match(denied.content[0].text, /Bower 403: Scope denied/)
      status = 200
    } finally { await client.close(); await transport.close() }
  }
  for (const code of [401, 403, 502, 302]) {
    status = code
    const before = requests
    const result = await cli(['projects'])
    assert.equal(result.code, 1); assert.equal(result.stdout, '')
    assert.doesNotMatch(result.stderr, /synthetic-test-token/)
    assert.equal(requests, before + 1, 'no retries or redirect credential forwarding')
  }
})
