// ---------------------------------------------------------------------------
// Trellis API — TypeScript type definitions
// ---------------------------------------------------------------------------

// -- Auth -------------------------------------------------------------------

export interface TrellisWhoAmI {
  kind: string
  scope: 'cluster'
  access: 'read' | 'write'
  subject?: {
    namespace: string
    job: string
    task_group: string
  }
  created_at?: string // ISO 8601
}

export interface TrellisJobLimits {
  max_replicas_per_task_group: number
  max_task_groups_per_job: number
  max_tasks_per_task_group: number
  max_desired_allocations: number
  max_desired_allocations_per_namespace: number
  default_task_cpu: number
  default_task_memory: number
  max_task_cpu: number
  max_task_memory: number
}

export interface TrellisClusterSettings {
  job_limits: TrellisJobLimits
}

// -- Nodes ------------------------------------------------------------------

export interface TrellisNode {
  id: string
  host: string
  port: number
  status: 'healthy' | 'unhealthy' | 'draining'
  cpu: number // legacy allocatable millicores
  memory: number // legacy allocatable bytes
  cpu_capacity?: number
  memory_capacity?: number
  cpu_allocatable?: number
  memory_allocatable?: number
  cpu_usage?: number // ratio from 0 to 1
  memory_used?: number
  memory_available?: number
  metrics_at?: string
  os?: string
  arch?: string
  labels?: Record<string, string>
  volumes?: string[]
  capabilities?: string[]
  version?: string
  last_heartbeat?: string // absent before the first heartbeat to this leader
  control_plane?: 'voter' | 'nonvoter'
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
  scope: 'cluster'
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
  | 'pending'
  | 'placed'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'lost'

export type TrellisHealthStatus = 'healthy' | 'unhealthy' | 'unknown'

export interface TrellisAllocationPort {
  host_port: number
  container_port: number
}

export interface TrellisAllocationEndpoint {
  task: string
  address?: string
  ports?: TrellisAllocationPort[]
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
  endpoints?: TrellisAllocationEndpoint[]
  labels: Record<string, string>
}

// -- Events -----------------------------------------------------------------

export interface TrellisEvent {
  phase: TrellisAllocationPhase
  reason?: string
  message: string
  at: string // ISO 8601
}

// -- Jobs (full response from GET /v1/jobs/{name}) --------------------------

export interface TrellisJob {
  name: string
  incarnation: string
  version: number
  revision: number
  desired: number
  running: number
  healthy: number
  allocations: TrellisAllocation[]
  replacement_backoff?: TrellisReplacementBackoff[]
  spec?: TrellisJobSpec
}

export interface TrellisReplacementBackoff {
  group: string
  job_revision: number
  failures: number
  last_failure_at: string
  last_allocation_id?: string
  reason?: string
  message?: string
  next_replacement_at: string
}

// -- Cluster settings -------------------------------------------------------

export interface TrellisClusterSettings {
  job_limits: {
    max_replicas_per_task_group: number
    max_task_groups_per_job: number
    max_tasks_per_task_group: number
    max_desired_allocations: number
    max_desired_allocations_per_namespace: number
    default_task_cpu: number
    default_task_memory: number
    max_task_cpu: number
    max_task_memory: number
  }
  reconciliation: {
    allocation_loss_timeout: number
    replacement_backoff_base: number
    replacement_backoff_max: number
    replacement_stable_after: number
    terminal_allocation_retention: number
  }
  network: {
    wireguard_pool: string
    wireguard_port_count: number
  }
}

// -- Plan (response from POST /v1/jobs/plan) --------------------------------

export interface TrellisPlanDiff {
  operation: 'add' | 'remove' | 'change'
  path: string
  before?: unknown
  after?: unknown
}

export interface TrellisPlan {
  action: 'create' | 'none' | 'update'
  namespace: string
  job: string
  base_incarnation?: string
  base_version?: number
  base_revision?: number
  desired_allocations: number
  changes: TrellisPlanDiff[]
}

// -- Secrets (metadata only) ------------------------------------------------

export interface TrellisSecret {
  name: string
  namespace: string
  version: number
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
  ciphertext_size: number
  key_id: string
}

// -- Request payloads -------------------------------------------------------

export interface TrellisSetSecretRequest {
  value_base64: string
  expected_version?: number
}

export interface TrellisApplyJobRequest {
  spec: TrellisJobSpec
  expected_version?: number
  expected_incarnation?: string
}

export interface TrellisPlanJobRequest {
  spec: TrellisJobSpec
}

// -- Job revisions ----------------------------------------------------------

export interface TrellisJobVersion {
  version: number
  revision: number
  spec: TrellisJobSpec
  created_at: string // ISO 8601
}

export interface TrellisJobApplyResult {
  namespace: string
  name: string
  incarnation: string
  version: number
  revision: number
}

// -- Allocation metrics -----------------------------------------------------

export interface TrellisAllocationMetrics {
  allocation_id: string
  task: string
  cpu_usage_nanoseconds: number
  memory_usage_bytes: number
  collected_at: string // ISO 8601
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
