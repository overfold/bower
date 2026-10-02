import type { BowerServiceConfig } from './job-builder'
import type { TrellisJobLimits } from '@/types/trellis'
import { parseJsonInput, validateCanarySteps, validateSecretBindings, validateVolumeMounts } from './workload-input'

const TIERS = { small: [100, 134217728], medium: [250, 268435456], large: [500, 536870912], xl: [1000, 1073741824] } as const

export function positiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive integer.`)
  return value
}

export function parseResourceInputs(cpu: string, memoryMB: string) {
  return {
    cpu: positiveInteger(Number(cpu), 'CPU (millicores)'),
    memory: positiveInteger(Number(memoryMB) * 1048576, 'Memory (bytes)'),
  }
}

export function parseDeploymentStrategy(value: string): BowerServiceConfig['deploymentStrategy'] {
  if (value !== 'rolling' && value !== 'recreate' && value !== 'blue_green' && value !== 'canary') {
    throw new Error('Invalid deployment strategy.')
  }
  return value
}

export function parseKeyValueLines(value: string, kind: 'env' | 'label') {
  const entries: Array<[string, string]> = []
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const split = line.indexOf('=')
    if (split < 1) throw new Error('Each key/value line must use KEY=value.')
    const key = line.slice(0, split).trim()
    const val = line.slice(split + 1).trim()
    if (kind === 'env') {
      // Bower's environment editor uses shell-style names. Literal Trellis env
      // keys are unrestricted; this is an existing Bower product convention.
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key}`)
    } else {
      if (!/^[A-Za-z][A-Za-z0-9._/-]{0,62}$/.test(key)) throw new Error(`Invalid label name: ${key}`)
      if (Buffer.byteLength(val, 'utf8') > 256) throw new Error(`Label ${key} must be at most 256 UTF-8 bytes.`)
    }
    entries.push([key, val])
  }
  return Object.fromEntries(entries)
}

function integerField(formData: FormData, key: string, label: string, fallback: number) {
  const value = String(formData.get(key) ?? '').trim()
  return positiveInteger(value ? Number(value) : fallback, label)
}

export function validateWorkloadAdmissionBounds(replicas: number, cpu: number, memory: number, limits?: TrellisJobLimits) {
  if (!limits) return
  if (replicas > limits.max_replicas_per_task_group || replicas > limits.max_desired_allocations) {
    throw new Error(`Replicas exceed the Trellis operator limit of ${Math.min(limits.max_replicas_per_task_group, limits.max_desired_allocations)}.`)
  }
  if (cpu > limits.max_task_cpu) throw new Error(`CPU exceeds the Trellis operator limit of ${limits.max_task_cpu} millicores.`)
  if (memory > limits.max_task_memory) throw new Error(`Memory exceeds the Trellis operator limit of ${limits.max_task_memory} bytes.`)
}

export function parseServiceConfigInput(formData: FormData, limits?: TrellisJobLimits) {
  const image = String(formData.get('image') ?? '').trim()
  if (!image) throw new Error('An image is required.')
  const replicas = positiveInteger(Number(formData.get('replicas')), 'Replicas')
  const tier = String(formData.get('resourceTier') ?? 'custom')
  if (tier !== 'small' && tier !== 'medium' && tier !== 'large' && tier !== 'xl' && tier !== 'custom') {
    throw new Error('Invalid resource tier.')
  }
  const { cpu, memory } = tier === 'custom'
    ? parseResourceInputs(String(formData.get('cpu') ?? ''), String(formData.get('memory') ?? ''))
    : { cpu: TIERS[tier][0], memory: TIERS[tier][1] }
  validateWorkloadAdmissionBounds(replicas, cpu, memory, limits)
  const healthCheckType = String(formData.get('healthType') ?? '') || null
  if (healthCheckType !== null && healthCheckType !== 'http' && healthCheckType !== 'tcp' && healthCheckType !== 'script') {
    throw new Error('Invalid health check type.')
  }
  const port = String(formData.get('healthPort') ?? '').trim()
  const healthCheckPort = port ? positiveInteger(Number(port), 'Health check port') : null
  if (healthCheckPort !== null && healthCheckPort > 65_535) throw new Error('Health check port must be between 1 and 65535.')
  if ((healthCheckType === 'http' || healthCheckType === 'tcp') && healthCheckPort === null) {
    throw new Error('HTTP and TCP health checks require a valid port.')
  }
  const healthCheckPath = String(formData.get('healthPath') ?? '').trim() || null
  if (healthCheckType === 'http' && healthCheckPath !== null && (
    Buffer.byteLength(healthCheckPath, 'utf8') > 1024
    || !/^\/(?:[A-Za-z0-9._~!$&'()*+,;=:@/?-]|%[0-9A-Fa-f]{2})*$/.test(healthCheckPath)
  )) throw new Error('HTTP health check path must be an encoded path/query beginning with /, at most 1024 bytes.')
  const healthCheckCommand = String(formData.get('healthCommand') ?? '').trim().split(/\s+/).filter(Boolean)
  if (healthCheckType === 'script' && healthCheckCommand.length === 0) throw new Error('Script health checks require a command.')
  const healthCheckInterval = integerField(formData, 'healthInterval', 'Health check interval (seconds)', 10)
  const healthCheckTimeout = integerField(formData, 'healthTimeout', 'Health check timeout (seconds)', 2)
  // Trellis durations are signed 64-bit nanoseconds, not cluster-policy limits.
  if (healthCheckInterval > 9_223_372_036 || healthCheckTimeout > 9_223_372_036) {
    throw new Error('Health check durations exceed the Trellis nanosecond range.')
  }
  return {
    image, replicas, resourceTier: tier, cpu, memory,
    deploymentStrategy: parseDeploymentStrategy(String(formData.get('strategy') ?? 'rolling')),
    healthCheckType, healthCheckPort, healthCheckPath, healthCheckCommand,
    healthCheckInterval, healthCheckTimeout,
    healthCheckThreshold: integerField(formData, 'healthThreshold', 'Health check threshold', 3),
    envVars: parseKeyValueLines(String(formData.get('envVars') ?? ''), 'env'),
    labels: parseKeyValueLines(String(formData.get('labels') ?? ''), 'label'),
    volumes: validateVolumeMounts(parseJsonInput(formData, 'volumes', [])),
    secretBindings: validateSecretBindings(parseJsonInput(formData, 'secretBindings', [])),
    autoRollbackSeconds: Math.max(30, Number(formData.get('autoRollbackSeconds')) || 300),
    canarySteps: validateCanarySteps(parseJsonInput(formData, 'canarySteps', [10, 25, 50, 100])),
    updatedAt: new Date(),
  } as const
}
