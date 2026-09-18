// ---------------------------------------------------------------------------
// Job builder — converts a Bower service config into a Trellis JobSpec
// ---------------------------------------------------------------------------

import type {
  TrellisApiAccess,
  TrellisJobSpec,
  TrellisTaskGroup,
  TrellisTask,
  TrellisHealthCheck,
  TrellisSecretRef,
  TrellisRestartPolicy,
  TrellisUpdateStrategy,
  TrellisNetworking,
  TrellisRuntime,
  TrellisVolume,
} from '@/types/trellis'

// ---------------------------------------------------------------------------
// Bower service configuration (the Bower-level abstraction)
// ---------------------------------------------------------------------------

export interface BowerSecretBinding {
  name: string
  target: 'env' | 'file'
  env?: string // env var name (when target = 'env')
  path?: string // mount path (when target = 'file')
}

export interface BowerServiceConfig {
  name: string
  serviceLabel?: string
  namespace: string
  image: string
  replicas: number
  cpu: number // millicores
  memory: number // bytes
  healthCheckPath?: string
  healthCheckType?: 'http' | 'tcp' | 'script'
  healthCheckPort?: number
  healthCheckCommand?: string[]
  healthCheckInterval?: number
  healthCheckTimeout?: number
  healthCheckThreshold?: number
  deploymentStrategy: 'rolling' | 'recreate' | 'blue_green' | 'canary'
  envVars: Record<string, string>
  secrets: BowerSecretBinding[]
  labels: Record<string, string>
  volumes: TrellisVolume[]
  runtime?: TrellisRuntime
  apiAccess?: TrellisApiAccess
}

// ---------------------------------------------------------------------------
// Duration helpers (Trellis uses nanoseconds)
// ---------------------------------------------------------------------------

const NS_PER_SECOND = 1_000_000_000
const NS_PER_MINUTE = 60 * NS_PER_SECOND

// ---------------------------------------------------------------------------
// Default health-check values
// ---------------------------------------------------------------------------

const DEFAULT_HEALTH_CHECK_INTERVAL = 10 * NS_PER_SECOND
const DEFAULT_HEALTH_CHECK_TIMEOUT = 2 * NS_PER_SECOND
const DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD = 3

// ---------------------------------------------------------------------------
// Worker restart defaults
// ---------------------------------------------------------------------------

const WORKER_MAX_RESTARTS = 3
const WORKER_RESTART_WINDOW = 5 * NS_PER_MINUTE

// ---------------------------------------------------------------------------
// Container image references
// ---------------------------------------------------------------------------

/**
 * Resolve an image without an explicit registry the same way Docker does.
 * A first path component containing a dot/colon (or exactly "localhost") is
 * treated as a registry hostname; everything else is a Docker Hub repository.
 */
export function normalizeContainerImage(image: string): string {
  const value = image.trim()
  if (!value) return value

  const slash = value.indexOf('/')
  if (slash === -1) return `docker.io/library/${value}`

  const firstComponent = value.slice(0, slash)
  if (firstComponent.includes('.') || firstComponent.includes(':') || firstComponent === 'localhost') {
    return value
  }

  return `docker.io/${value}`
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Convert a Bower service configuration into a Trellis JobSpec that can be
 * submitted to `POST /v1/jobs` (or `/v1/jobs/plan`).
 */
export function buildJobSpec(config: BowerServiceConfig): TrellisJobSpec {
  const primaryTask = buildPrimaryTask(config)

  const labels: Record<string, string> = {
    ...config.labels,
    'bower/managed': 'true',
    'bower/service': config.serviceLabel ?? config.name,
  }

  const taskGroup: TrellisTaskGroup = {
    name: config.name,
    count: config.replicas,
    runtime: config.runtime ?? 'runc',
    labels,
    tasks: [primaryTask],
  }

  if (config.apiAccess) {
    taskGroup.api_access = config.apiAccess
  }

  const restart = buildRestartPolicy()
  if (restart) {
    taskGroup.restart = restart
  }

  // Update strategy
  const update = buildUpdateStrategy(config)
  if (update) {
    taskGroup.update = update
  }

  return {
    name: config.name,
    namespace: config.namespace,
    task_groups: [taskGroup],
  }
}

// ---------------------------------------------------------------------------
// Task builders
// ---------------------------------------------------------------------------

function buildPrimaryTask(config: BowerServiceConfig): TrellisTask {
  const task: TrellisTask = {
    name: config.name,
    image: normalizeContainerImage(config.image),
    resources: {
      cpu: config.cpu,
      memory: config.memory,
    },
    networking: buildNetworking(),
  }

  if (config.volumes.length > 0) task.volumes = config.volumes

  // Environment variables
  if (Object.keys(config.envVars).length > 0) {
    task.env = { ...config.envVars }
  }

  // Secrets
  if (config.secrets.length > 0) {
    task.secrets = config.secrets.map(buildSecretRef)
  }

  // Health check
  const healthCheck = buildHealthCheck(config)
  if (healthCheck) {
    task.health_check = healthCheck
  }

  return task
}

// ---------------------------------------------------------------------------
// Sub-builders
// ---------------------------------------------------------------------------

function buildSecretRef(binding: BowerSecretBinding): TrellisSecretRef {
  const ref: TrellisSecretRef = {
    name: binding.name,
    target: binding.target,
  }
  if (binding.target === 'env' && binding.env) {
    ref.env = binding.env
  }
  if (binding.target === 'file' && binding.path) {
    ref.path = binding.path
  }
  return ref
}

function buildNetworking(): TrellisNetworking {
  // Bower intentionally does not expose Trellis networking modes. Application
  // workloads always join their environment's Trellis namespace network; Bower
  // owns public exposure and routing as a higher-level product concept.
  return { mode: 'namespace' }
}

function buildHealthCheck(config: BowerServiceConfig): TrellisHealthCheck | null {
  if (!config.healthCheckType) {
    return null
  }

  const checkType = config.healthCheckType

  const check: TrellisHealthCheck = {
    type: checkType,
    interval: (config.healthCheckInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL / NS_PER_SECOND) * NS_PER_SECOND,
    timeout: (config.healthCheckTimeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT / NS_PER_SECOND) * NS_PER_SECOND,
    threshold: config.healthCheckThreshold ?? DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
  }

  if (checkType === 'http') {
    check.path = config.healthCheckPath ?? '/'
    if (config.healthCheckPort !== undefined) {
      check.port = config.healthCheckPort
    }
  }

  if (checkType === 'tcp') {
    if (config.healthCheckPort !== undefined) {
      check.port = config.healthCheckPort
    }
  }

  if (checkType === 'script') check.command = config.healthCheckCommand ?? []

  return check
}

function buildRestartPolicy(): TrellisRestartPolicy | null {
  return {
    max_restarts: WORKER_MAX_RESTARTS,
    window: WORKER_RESTART_WINDOW,
  }
}

function buildUpdateStrategy(
  config: BowerServiceConfig,
): TrellisUpdateStrategy | null {
  switch (config.deploymentStrategy) {
    case 'rolling':
      return config.replicas >= 2
        ? { strategy: 'rolling', max_parallel: 1 }
        : { strategy: 'recreate' }
    case 'recreate':
      return { strategy: 'recreate' }
    case 'blue_green':
    case 'canary':
      // blue-green and canary are orchestrated at the Bower level;
      // the underlying Trellis job still has to satisfy Trellis's rule that
      // rolling updates require at least two desired allocations.
      return config.replicas >= 2
        ? { strategy: 'rolling', max_parallel: 1 }
        : { strategy: 'recreate' }
    default:
      return null
  }
}
