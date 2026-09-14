// ---------------------------------------------------------------------------
// Job builder — converts a Bower service config into a Trellis JobSpec
// ---------------------------------------------------------------------------

import type {
  TrellisJobSpec,
  TrellisTaskGroup,
  TrellisTask,
  TrellisHealthCheck,
  TrellisSecretRef,
  TrellisRestartPolicy,
  TrellisUpdateStrategy,
  TrellisNetworking,
  TrellisVolume,
} from '@/types/trellis'

// ---------------------------------------------------------------------------
// Bower service configuration (the Bower-level abstraction)
// ---------------------------------------------------------------------------

export interface BowerSidecar {
  name: string
  image: string
  cpu: number // millicores
  memory: number // bytes
  port?: number
  envVars: Record<string, string>
  command?: string
}

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
  port?: number
  replicas: number
  cpu: number // millicores
  memory: number // bytes
  healthCheckPath?: string
  healthCheckType?: 'http' | 'tcp' | 'script'
  healthCheckCommand?: string[]
  healthCheckInterval?: number
  healthCheckTimeout?: number
  healthCheckThreshold?: number
  deploymentStrategy: 'rolling' | 'recreate' | 'blue_green' | 'canary'
  envVars: Record<string, string>
  secrets: BowerSecretBinding[]
  labels: Record<string, string>
  command?: string
  sidecars: BowerSidecar[]
  volumes: TrellisVolume[]
  rawConfig?: TrellisJobSpec
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
// Builder
// ---------------------------------------------------------------------------

/**
 * Convert a Bower service configuration into a Trellis JobSpec that can be
 * submitted to `POST /v1/jobs` (or `/v1/jobs/plan`).
 */
export function buildJobSpec(config: BowerServiceConfig): TrellisJobSpec {
  if (config.rawConfig) {
    return { ...config.rawConfig, name: config.name, namespace: config.namespace, task_groups: config.rawConfig.task_groups.map((group) => ({ ...group, labels: { ...group.labels, 'bower/managed': 'true', 'bower/service': config.serviceLabel ?? config.name } })) }
  }
  const primaryTask = buildPrimaryTask(config)
  const sidecarTasks = config.sidecars.map((s) => buildSidecarTask(s))
  const tasks = [primaryTask, ...sidecarTasks]

  const labels: Record<string, string> = {
    ...config.labels,
    'bower/managed': 'true',
    'bower/service': config.serviceLabel ?? config.name,
  }

  const taskGroup: TrellisTaskGroup = {
    name: config.name,
    count: config.replicas,
    labels,
    tasks,
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
    image: config.image,
    resources: {
      cpu: config.cpu,
      memory: config.memory,
    },
  }

  if (config.command) {
    task.command = config.command
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

  const networking = buildNetworking(config)
  if (networking) {
    task.networking = networking
  }

  // Health check
  const healthCheck = buildHealthCheck(config)
  if (healthCheck) {
    task.health_check = healthCheck
  }

  return task
}

function buildSidecarTask(sidecar: BowerSidecar): TrellisTask {
  const task: TrellisTask = {
    name: sidecar.name,
    image: sidecar.image,
    resources: {
      cpu: sidecar.cpu,
      memory: sidecar.memory,
    },
  }

  if (sidecar.command) {
    task.command = sidecar.command
  }

  if (Object.keys(sidecar.envVars).length > 0) {
    task.env = { ...sidecar.envVars }
  }

  if (sidecar.port !== undefined) {
    task.networking = {
      mode: 'host',
      ports: [{ port: sidecar.port }],
    }
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

function buildNetworking(config: BowerServiceConfig): TrellisNetworking | null {
  if (config.port === undefined) {
    return null
  }

  return {
    mode: 'host',
    ports: [{ port: config.port }],
  }
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
    if (config.port !== undefined) {
      check.port = config.port
    }
  }

  if (checkType === 'tcp') {
    if (config.port !== undefined) {
      check.port = config.port
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
      return { strategy: 'rolling', max_parallel: 1 }
    case 'recreate':
      return { strategy: 'recreate' }
    case 'blue_green':
    case 'canary':
      // blue-green and canary are orchestrated at the Bower level;
      // the underlying Trellis job uses a rolling strategy.
      return { strategy: 'rolling', max_parallel: 1 }
    default:
      return null
  }
}
