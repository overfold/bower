// ---------------------------------------------------------------------------
// TrellisClient — HTTP client for the Trellis container orchestrator API
// ---------------------------------------------------------------------------

import type {
  TrellisWhoAmI,
  TrellisNode,
  TrellisJob,
  TrellisJobSpec,
  TrellisApplyJobResponse,
  TrellisPlan,
  TrellisAllocation,
  TrellisEvent,
  TrellisSecret,
  TrellisJobRevision,
  TrellisAllocationMetrics,
  TrellisExecResponse,
  TrellisExecSession,
  TrellisExecSessionCreateRequest,
  TrellisExecSessionOutput,
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
    // Normalise: strip trailing slashes so callers don't need to worry
    this.baseUrl = apiUrl.replace(/\/+$/, '')
    this.token = token
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private headers(namespace?: string): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    }
    if (namespace) {
      h['X-Trellis-Namespace'] = namespace
    }
    return h
  }

  private headersJson(namespace?: string): Record<string, string> {
    return {
      ...this.headers(namespace),
      'Content-Type': 'application/json',
    }
  }

  /** Perform a request and throw TrellisApiError on non-2xx responses. */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown
      namespace?: string
      headers?: Record<string, string>
      rawText?: boolean
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const hasBody = options?.body !== undefined

    const fetchHeaders = hasBody
      ? this.headersJson(options?.namespace)
      : this.headers(options?.namespace)

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

  async listJobs(namespace?: string): Promise<TrellisJob[]> {
    return this.request<TrellisJob[]>('GET', '/v1/jobs', { namespace })
  }

  async getJob(name: string, namespace?: string): Promise<TrellisJob> {
    return this.request<TrellisJob>('GET', `/v1/jobs/${encodeURIComponent(name)}`, {
      namespace,
    })
  }

  async applyJob(
    spec: TrellisJobSpec,
    namespace?: string,
  ): Promise<TrellisApplyJobResponse> {
    return this.request<TrellisApplyJobResponse>('POST', '/v1/jobs', {
      body: { spec },
      namespace,
    })
  }

  async planJob(
    spec: TrellisJobSpec,
    namespace?: string,
  ): Promise<TrellisPlan> {
    return this.request<TrellisPlan>('POST', '/v1/jobs/plan', {
      body: { spec },
      namespace,
    })
  }

  async deleteJob(name: string, namespace?: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/jobs/${encodeURIComponent(name)}`, {
      namespace,
    })
  }

  async restartJob(name: string, namespace?: string): Promise<void> {
    await this.request<void>('POST', `/v1/jobs/${encodeURIComponent(name)}/restart`, { namespace })
  }

  async getJobRevisions(name: string, namespace?: string): Promise<TrellisJobRevision[]> {
    return this.request<TrellisJobRevision[]>('GET', `/v1/jobs/${encodeURIComponent(name)}/revisions`, { namespace })
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
    const path = qs ? `/v1/allocations?${qs}` : '/v1/allocations'
    return this.request<TrellisAllocation[]>('GET', path, {
      namespace: filters?.namespace,
    })
  }

  async getAllocationEvents(id: string): Promise<TrellisEvent[]> {
    return this.request<TrellisEvent[]>(
      'GET',
      `/v1/allocations/${encodeURIComponent(id)}/events`,
    )
  }

  async stopAllocation(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/allocations/${encodeURIComponent(id)}`)
  }

  async execAllocation(id: string, task: string, command: string[]): Promise<TrellisExecResponse> {
    return this.request<TrellisExecResponse>('POST', `/v1/allocations/${encodeURIComponent(id)}/exec`, {
      body: { task, command },
    })
  }

  async createExecSession(id: string, request: TrellisExecSessionCreateRequest): Promise<TrellisExecSession> {
    return this.request<TrellisExecSession>('POST', `/v1/allocations/${encodeURIComponent(id)}/exec/sessions`, {
      body: request,
    })
  }

  async writeExecSession(id: string, sessionId: string, dataBase64: string): Promise<void> {
    await this.request<void>(
      'POST',
      `/v1/allocations/${encodeURIComponent(id)}/exec/sessions/${encodeURIComponent(sessionId)}/input`,
      { body: { data_base64: dataBase64 } },
    )
  }

  async readExecSession(id: string, sessionId: string, offset: number): Promise<TrellisExecSessionOutput> {
    const params = new URLSearchParams({ offset: String(offset) })
    return this.request<TrellisExecSessionOutput>(
      'GET',
      `/v1/allocations/${encodeURIComponent(id)}/exec/sessions/${encodeURIComponent(sessionId)}/output?${params.toString()}`,
    )
  }

  async resizeExecSession(id: string, sessionId: string, cols: number, rows: number): Promise<void> {
    await this.request<void>(
      'POST',
      `/v1/allocations/${encodeURIComponent(id)}/exec/sessions/${encodeURIComponent(sessionId)}/resize`,
      { body: { cols, rows } },
    )
  }

  async closeExecSession(id: string, sessionId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/v1/allocations/${encodeURIComponent(id)}/exec/sessions/${encodeURIComponent(sessionId)}`,
    )
  }

  async getAllocationMetrics(id: string): Promise<TrellisAllocationMetrics[]> {
    return this.request<TrellisAllocationMetrics[]>('GET', `/v1/allocations/${encodeURIComponent(id)}/metrics`)
  }

  async getAllocationLogs(
    id: string,
    task: string,
    tail?: number,
  ): Promise<string> {
    const params = new URLSearchParams()
    params.set('task', task)
    if (tail !== undefined) {
      params.set('tail', String(tail))
    }
    return this.request<string>(
      'GET',
      `/v1/allocations/${encodeURIComponent(id)}/logs?${params.toString()}`,
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
  async streamEvents(namespace?: string): Promise<Response> {
    const url = `${this.baseUrl}/v1/events`
    return fetch(url, { headers: this.headers(namespace) })
  }
}
