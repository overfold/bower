import { z } from 'zod/v4'

const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Expected a Bower UUID')
const service = { serviceId: id, environmentId: id }
const allocation = { ...service, allocationId: z.string().min(1).max(256) }

// One operation inventory drives both adapters; Bower remains the authority for
// scopes, current membership, resource ownership, execution and audit actors.
export const operations = {
  projects: { description: 'List authorized Bower projects.', schema: z.object({}).strict() },
  environments: { description: 'List authorized environments in a Bower project.', schema: z.object({ projectId: id }).strict() },
  services: { description: 'List services in a Bower project.', schema: z.object({ projectId: id }).strict() },
  deployments: { description: 'Read recent recorded deployments in a service environment.', schema: z.object(service).strict() },
  allocations: { description: 'Read current application allocations in a service environment.', schema: z.object(service).strict() },
  logs: { description: 'Read the last 200 log lines for an owned application allocation. Logs may contain sensitive data.', schema: z.object({ ...allocation, task: z.string().min(1).max(256).optional() }).strict() },
  metrics: { description: 'Read current allocation memory and cumulative CPU usage, not historical rates.', schema: z.object(allocation).strict() },
  deploy: { description: 'Deploy an image using Bower configuration and strategy. Acceptance does not mean healthy completion. Do not blindly retry.', method: 'POST', schema: z.object({ ...service, image: z.string().trim().min(1).max(2048), confirm: z.literal(true) }).strict() },
  restart: { description: 'Restart the active application job. Does not create a deployment record. Do not blindly retry.', method: 'PATCH', schema: z.object({ ...service, confirm: z.literal(true) }).strict() },
  rollback: { description: 'Restore an explicit earlier healthy deployment with its recorded image pins. Do not blindly retry.', method: 'PATCH', schema: z.object({ ...service, targetDeploymentId: id, confirm: z.literal(true) }).strict() },
}

export function createClient(env = process.env) {
  let base
  try { base = new URL(env.BOWER_URL) } catch { throw new Error('Set BOWER_URL to your Bower origin.') }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('BOWER_URL must be an HTTPS origin (HTTP is allowed only on loopback), without credentials or a path.')
  }
  const token = env.BOWER_TOKEN
  if (!token || /\s/.test(token)) throw new Error('Set BOWER_TOKEN to a scoped Bower API key.')
  return async (operation, input) => {
    const definition = operations[operation]
    if (!definition) throw new Error('Unknown Bower operation.')
    const parsed = definition.schema.safeParse(input)
    if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error.issues.map(issue => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; ')}`)
    const args = { ...parsed.data }
    delete args.confirm
    const url = new URL('/api/v1/automation', base)
    const method = definition.method || 'GET'
    if (method === 'GET') url.search = new URLSearchParams({ operation, ...args }).toString()
    let response
    try {
      response = await fetch(url, {
        method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(method !== 'GET' ? { body: JSON.stringify(method === 'PATCH' ? { operation, ...args } : args) } : {}),
      })
    } catch { throw new Error('Bower request failed or timed out. For writes, diagnose state before retrying; the outcome may be unknown.') }
    let result
    try { result = await response.json() } catch { throw new Error(`Bower returned a non-JSON response (${response.status}).`) }
    if (!response.ok) throw new Error(`Bower ${response.status}: ${typeof result?.error === 'string' ? result.error : 'Request rejected.'}`)
    return result
  }
}
