// ---------------------------------------------------------------------------
// Trellis API — TypeScript type definitions
// ---------------------------------------------------------------------------

// -- Auth -------------------------------------------------------------------

export interface TrellisWhoAmI {
  kind: string
  scope: 'cluster' | 'namespace'
  access: 'read' | 'write'
  namespace: string | null
  created_at: string // ISO 8601
}

// -- Nodes ------------------------------------------------------------------

export interface TrellisNode {
  id: string
  host: string
  port: number
  status: 'healthy' | 'unhealthy' | 'draining'
  cpu: number // millicores capacity
  memory: number // bytes capacity
  cpu_used?: number
  memory_used?: number
  os: string
  arch: string
  labels: Record<string, string>
  host_volumes?: string[]
  volumes?: string[]
  version: string
  last_heartbeat: string // ISO 8601
}

// -- Constraints ------------------------------------------------------------

export interface TrellisConstraint {
  attribute: string
  value: string
}

// -- Volumes ----------------------------------------------------------------

export interface TrellisVolume {
  name: string
  host_path: string
  container_path: string
  read_only?: boolean
}

// -- Secret references (within a task spec) ---------------------------------

export interface TrellisSecretRef {
  name: string
  target: 'env' | 'file'
  env?: string // environment variable name when target = 'env'
  path?: string // file path when target = 'file'
  mode?: number
}

// -- Health checks ----------------------------------------------------------

export interface TrellisHealthCheck {
  type: 'http' | 'tcp' | 'script'
  path?: string // HTTP path (for http checks)
  port?: number // port to check (http / tcp)
  command?: string[] // command to run (script checks)
  interval?: number // nanoseconds
  timeout?: number // nanoseconds
  threshold?: number
}

// -- Tasks ------------------------------------------------------------------

export interface TrellisTask {
  name: string
  image: string
  command?: string
  env?: Record<string, string>
  networking?: TrellisNetworking
  resources?: TrellisResources
  volumes?: TrellisVolume[]
  secrets?: TrellisSecretRef[]
  health_check?: TrellisHealthCheck
}

export interface TrellisNetworking {
  mode?: 'isolated' | 'host' | 'namespace'
  ports?: TrellisPort[]
}

export interface TrellisPort {
  port: number
}

export interface TrellisResources {
  cpu?: number // millicores
  memory?: number // bytes
}

// -- Task groups ------------------------------------------------------------

export interface TrellisRestartPolicy {
  max_restarts: number
  window: number // nanoseconds
}

export interface TrellisUpdateStrategy {
  strategy: 'recreate' | 'rolling'
  max_parallel?: number
}

export interface TrellisApiAccess {
  scope: 'namespace' | 'cluster'
  access: 'read' | 'write'
}

export type TrellisRuntime = '' | 'runc' | 'runsc'

export interface TrellisTaskGroup {
  name: string
  count: number
  runtime?: TrellisRuntime
  labels?: Record<string, string>
  constraints?: TrellisConstraint[]
  api_access?: TrellisApiAccess
  restart?: TrellisRestartPolicy
  update?: TrellisUpdateStrategy
  tasks: TrellisTask[]
}

// -- Job spec (the payload submitted to POST /v1/jobs) ----------------------

export interface TrellisJobSpec {
  name: string
  namespace: string
  task_groups: TrellisTaskGroup[]
}

// -- Allocations ------------------------------------------------------------

export type TrellisAllocationPhase =
  | 'placed'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'lost'

export type TrellisHealthStatus = 'healthy' | 'unhealthy' | 'unknown'

export interface TrellisAllocationPort {
  label: string
  port: number
  host_port: number
}

export interface TrellisAllocation {
  id: string
  job: string
  group: string
  namespace: string
  node_id: string
  address?: string
  phase: TrellisAllocationPhase
  health: TrellisHealthStatus
  draining: boolean
  generation: number
  job_revision: number
  created_at: string // ISO 8601
  last_transition_at: string
  reason?: string
  message?: string
  attempt: number
  next_retry_at?: string
  ports: TrellisAllocationPort[]
  labels: Record<string, string>
  events: TrellisEvent[]
}

// -- Events -----------------------------------------------------------------

export interface TrellisEvent {
  phase: TrellisAllocationPhase
  reason?: string
  message: string
  at: string // ISO 8601
}

// -- Jobs (full response from GET /v1/jobs/{name}) --------------------------

export type TrellisJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead'

export interface TrellisJob {
  name: string
  namespace: string
  status?: TrellisJobStatus
  revision: number
  spec: TrellisJobSpec
  allocations?: TrellisAllocation[]
}

// -- Plan (response from POST /v1/jobs/plan) --------------------------------

export interface TrellisPlanDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  field: string
  old_value?: unknown
  new_value?: unknown
}

export interface TrellisPlan {
  job_name: string
  namespace: string
  diff: TrellisPlanDiff[]
  annotations: string[]
  created: boolean
  warnings: string[]
}

// -- Secrets (metadata only) ------------------------------------------------

export interface TrellisSecret {
  name: string
  namespace: string
  version: number
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

// -- Request payloads -------------------------------------------------------

export interface TrellisSetSecretRequest {
  value_base64: string
  expected_version?: number
}

export interface TrellisApplyJobRequest {
  spec: TrellisJobSpec
}

export interface TrellisPlanJobRequest {
  spec: TrellisJobSpec
}

// -- API response wrappers (for apply) --------------------------------------

export interface TrellisApplyJobResponse {
  created: boolean
  revision?: number
}

// -- Job revisions ----------------------------------------------------------

export interface TrellisJobRevision {
  revision: number
  spec: TrellisJobSpec
  created_at: string // ISO 8601
}

// -- Allocation metrics -----------------------------------------------------

export interface TrellisAllocationMetrics {
  allocation_id: string
  task: string
  cpu_usage_nanoseconds: number
  memory_usage_bytes: number
  collected_at: string // ISO 8601
}

// -- Exec -------------------------------------------------------------------

export interface TrellisExecResponse {
  stdout: string
  stderr: string
  exit_code: number
}

// -- Cluster events (SSE) ---------------------------------------------------

export type TrellisClusterEventType =
  | 'allocation.phase_changed'
  | 'allocation.health_changed'
  | 'job.registered'
  | 'job.deleted'

export interface TrellisClusterEvent {
  type: TrellisClusterEventType
  namespace?: string
  job?: string
  allocation_id?: string
  phase?: string
  health?: string
  revision?: number
  at: string // ISO 8601
}
