// ---------------------------------------------------------------------------
// TrellisClient — HTTP client for the Trellis container orchestrator API
// ---------------------------------------------------------------------------

import type {
  TrellisWhoAmI,
  TrellisNode,
  TrellisJob,
  TrellisJobSpec,
  TrellisPlan,
  TrellisAllocation,
  TrellisEvent,
  TrellisSecret,
  TrellisJobVersion,
  TrellisJobApplyResult,
  TrellisAllocationMetrics,
} from '@/types/trellis'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class TrellisApiError extends Error {
  public readonly status: number
  public readonly statusText: string
  public readonly body: string

  constructor(status: number, statusText: string, body: string) {
    super(`Trellis API error ${status} (${statusText}): ${body}`)
    this.name = 'TrellisApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }

  /** Attempt to parse the response body as JSON. Returns undefined on failure. */
  get json(): Record<string, unknown> | undefined {
    try {
      return JSON.parse(this.body) as Record<string, unknown>
    } catch {
      return undefined
    }
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class TrellisClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(apiUrl: string, token: string) {
    const address = apiUrl.trim().replace(/\/+$/, '')
    this.baseUrl = /^https?:\/\//i.test(address) ? address : `https://${address}`
    this.token = token
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    }
    return h
  }

  private headersJson(): Record<string, string> {
    return {
      ...this.headers(),
      'Content-Type': 'application/json',
    }
  }

  private resourcePath(namespace: string, path: string): string {
    if (!namespace) throw new Error('A Trellis namespace is required.')
    return `/v1/namespaces/${encodeURIComponent(namespace)}${path}`
  }

  /** Perform a request and throw TrellisApiError on non-2xx responses. */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown
      headers?: Record<string, string>
      rawText?: boolean
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const hasBody = options?.body !== undefined

    const fetchHeaders = hasBody
      ? this.headersJson()
      : this.headers()

    if (options?.headers) {
      Object.assign(fetchHeaders, options.headers)
    }

    const res = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: hasBody ? JSON.stringify(options!.body) : undefined,
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new TrellisApiError(res.status, res.statusText, errorBody)
    }

    // Trellis uses 202 and 204 for successful mutations with empty bodies.
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as unknown as T
    }

    if (options?.rawText) {
      return (await res.text()) as unknown as T
    }

    const responseText = await res.text()
    if (!responseText) return undefined as unknown as T
    return JSON.parse(responseText) as T
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async whoami(): Promise<TrellisWhoAmI> {
    return this.request<TrellisWhoAmI>('GET', '/v1/auth/whoami')
  }

  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  async listNodes(): Promise<TrellisNode[]> {
    return this.request<TrellisNode[]>('GET', '/v1/nodes')
  }

  async getMetrics(): Promise<string> {
    return this.request<string>('GET', '/metrics', { rawText: true })
  }

  async drainNode(id: string): Promise<void> {
    await this.request<void>('POST', `/v1/nodes/${encodeURIComponent(id)}/drain`)
  }

  async undrainNode(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/nodes/${encodeURIComponent(id)}/drain`)
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  async listJobs(namespace: string): Promise<TrellisJob[]> {
    return this.request<TrellisJob[]>('GET', this.resourcePath(namespace, '/jobs'))
  }

  async getJob(name: string, namespace: string): Promise<TrellisJob> {
    return this.request<TrellisJob>('GET', this.resourcePath(namespace, `/jobs/${encodeURIComponent(name)}`))
  }

  async applyJob(
    spec: TrellisJobSpec,
    namespace: string,
    precondition?: { expectedVersion: number; expectedIncarnation?: string },
  ): Promise<TrellisJobApplyResult> {
    return this.request<TrellisJobApplyResult>('POST', this.resourcePath(namespace, '/jobs'), {
      body: {
        spec,
        ...(precondition ? { expected_version: precondition.expectedVersion } : {}),
        ...(precondition?.expectedIncarnation ? { expected_incarnation: precondition.expectedIncarnation } : {}),
      },
    })
  }

  async applyJobPlan(spec: TrellisJobSpec, namespace: string, plan: TrellisPlan): Promise<TrellisJobApplyResult> {
    if (plan.namespace !== namespace || plan.job !== spec.name) throw new Error('The Trellis plan does not match the requested job.')
    if (plan.action === 'none') {
      if (!plan.base_incarnation || !plan.base_version || !plan.base_revision) throw new Error('An unchanged Trellis plan is missing its job identity.')
      return { namespace, name: spec.name, incarnation: plan.base_incarnation, version: plan.base_version, revision: plan.base_revision }
    }
    if (plan.action === 'update' && (!plan.base_incarnation || !plan.base_version || !plan.base_revision)) {
      throw new Error('An update Trellis plan is missing its job identity.')
    }
    return this.applyJob(spec, namespace, {
      expectedVersion: plan.action === 'create' ? 0 : plan.base_version ?? 0,
      expectedIncarnation: plan.action === 'update' ? plan.base_incarnation : undefined,
    })
  }

  async planJob(
    spec: TrellisJobSpec,
    namespace: string,
  ): Promise<TrellisPlan> {
    return this.request<TrellisPlan>('POST', this.resourcePath(namespace, '/jobs/plan'), {
      body: { spec },
    })
  }

  async deleteJob(name: string, namespace: string): Promise<void> {
    await this.request<void>('DELETE', this.resourcePath(namespace, `/jobs/${encodeURIComponent(name)}`))
  }

  async restartJob(name: string, namespace: string): Promise<void> {
    await this.request<void>('POST', this.resourcePath(namespace, `/jobs/${encodeURIComponent(name)}/restart`))
  }

  async getJobVersions(name: string, namespace: string): Promise<TrellisJobVersion[]> {
    return this.request<TrellisJobVersion[]>('GET', this.resourcePath(namespace, `/jobs/${encodeURIComponent(name)}/versions`))
  }

  // -------------------------------------------------------------------------
  // Namespaces
  // -------------------------------------------------------------------------

  async listNamespaces(): Promise<string[]> {
    return this.request<string[]>('GET', '/v1/namespaces')
  }

  // -------------------------------------------------------------------------
  // Allocations
  // -------------------------------------------------------------------------

  async listAllocations(
    filters?: { namespace?: string; label?: string; job?: string },
  ): Promise<TrellisAllocation[]> {
    const params = new URLSearchParams()
    if (filters?.label) {
      params.set('label', filters.label)
    }
    if (filters?.job) params.set('job', filters.job)
    const qs = params.toString()
    // Omitting namespace is an intentional cluster-wide read (dashboard).
    const path = filters?.namespace !== undefined
      ? this.resourcePath(filters.namespace, '/allocations')
      : '/v1/allocations'
    return this.request<TrellisAllocation[]>('GET', qs ? `${path}?${qs}` : path)
  }

  async getAllocationEvents(id: string, namespace: string): Promise<TrellisEvent[]> {
    return this.request<TrellisEvent[]>(
      'GET',
      this.resourcePath(namespace, `/allocations/${encodeURIComponent(id)}/events`),
    )
  }

  async stopAllocation(id: string, namespace: string): Promise<void> {
    await this.request<void>('DELETE', this.resourcePath(namespace, `/allocations/${encodeURIComponent(id)}`))
  }

  /** Server-only connection descriptor for the HTTP/1.1 exec bridge. */
  getExecConnection(id: string, namespace: string, task: string | undefined, cols: number, rows: number) {
    const params = new URLSearchParams({ stdin: 'true', tty: 'true', term: 'xterm-256color', cols: String(cols), rows: String(rows) })
    params.append('command', '/bin/sh')
    if (task) params.set('task', task)
    return {
      url: `${this.baseUrl}${this.resourcePath(namespace, `/allocations/${encodeURIComponent(id)}/exec`)}?${params}`,
      headers: { Authorization: `Bearer ${this.token}`, Connection: 'Upgrade', Upgrade: 'trellis-exec.v1' },
    }
  }

  async getAllocationMetrics(id: string, namespace: string): Promise<TrellisAllocationMetrics[]> {
    return this.request<TrellisAllocationMetrics[]>('GET', this.resourcePath(namespace, `/allocations/${encodeURIComponent(id)}/metrics`))
  }

  async getAllocationLogs(
    id: string,
    task: string,
    namespace: string,
    tail?: number,
  ): Promise<string> {
    const params = new URLSearchParams()
    params.set('task', task)
    if (tail !== undefined) {
      params.set('tail', String(tail))
    }
    return this.request<string>(
      'GET',
      `${this.resourcePath(namespace, `/allocations/${encodeURIComponent(id)}/logs`)}?${params.toString()}`,
      { rawText: true },
    )
  }

  // -------------------------------------------------------------------------
  // Secrets
  // -------------------------------------------------------------------------

  async listSecrets(namespace: string): Promise<TrellisSecret[]> {
    return this.request<TrellisSecret[]>(
      'GET',
      `/v1/namespaces/${encodeURIComponent(namespace)}/secrets`,
    )
  }

  async getSecret(namespace: string, name: string): Promise<TrellisSecret> {
    return this.request<TrellisSecret>(
      'GET',
      `/v1/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`,
    )
  }

  async setSecret(
    namespace: string,
    name: string,
    value: string,
    expectedVersion?: number,
  ): Promise<void> {
    // The API expects the value as base64
    const value_base64 = Buffer.from(value, 'utf-8').toString('base64')

    await this.request<void>(
      'PUT',
      `/v1/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`,
      {
        body: {
          value_base64,
          ...(expectedVersion !== undefined
            ? { expected_version: expectedVersion }
            : {}),
        },
      },
    )
  }

  async deleteSecret(namespace: string, name: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/v1/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`,
    )
  }

  /** Return a raw fetch Response for the SSE event stream. Caller is responsible for piping or consuming the body. */
  async streamEvents(namespace: string, signal?: AbortSignal): Promise<Response> {
    const url = `${this.baseUrl}${this.resourcePath(namespace, '/events')}`
    return fetch(url, { headers: this.headers(), signal })
  }
}
