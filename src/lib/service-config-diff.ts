import type { MergedServiceConfig } from '@/lib/queries'
import type { TrellisJobSpec } from '@/types/trellis'

export type ServiceConfigValue = string | number | boolean | null | ServiceConfigValue[] | { [key: string]: ServiceConfigValue }
export type ServiceConfigDiff = {
  kind: 'config'
  key: string
  label: string
  before: ServiceConfigValue
  after: ServiceConfigValue
  /** Set to false when that side's value is absent from the stored spec: "not recorded", which is not the same as "none". */
  beforeRecorded?: false
  afterRecorded?: false
} | {
  kind: 'environment'
  key: string
  label: 'Environment'
  variable: string
  change: 'Added' | 'Changed' | 'Removed'
  before: EnvironmentSide
  after: EnvironmentSide
}
/** Plain variables carry their value; values bound from secrets are only ever marked masked. */
export type EnvironmentSide = { present: boolean; masked: boolean; value?: string }

/** Resources and health checks that Trellis omits from a spec rather than recording as empty. */
const RECORDED_KEYS = new Set(['cpu', 'memory', 'health'])

const sorted = (value: unknown): unknown => Array.isArray(value)
  ? value.map(sorted)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]))
    : value
const equal = (a: unknown, b: unknown) => JSON.stringify(sorted(a ?? null)) === JSON.stringify(sorted(b ?? null))
const bindings = (value: unknown) => Array.isArray(value) ? value.map(({ name, target, env, path }) => ({ name, target, ...(env ? { env } : {}), ...(path ? { path } : {}) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : []
const environmentKeys = (env: unknown, secrets: unknown) => {
  const result: Record<string, string> = { ...((env && typeof env === 'object' && !Array.isArray(env)) ? env as Record<string, string> : {}) }
  for (const binding of bindings(secrets)) if (binding.target === 'env' && binding.env) result[binding.env] = '••••••••'
  return Object.keys(result).sort()
}
const healthConfig = (type: string | null | undefined, values: { path?: unknown; port?: unknown; command?: unknown; interval?: unknown; timeout?: unknown; threshold?: unknown }) => type ? {
  type,
  ...(type === 'http' ? { path: values.path ?? '/' } : {}),
  ...(type === 'http' || type === 'tcp' ? (values.port == null ? {} : { port: values.port }) : {}),
  ...(type === 'script' ? { command: values.command ?? [] } : {}),
  interval: values.interval,
  timeout: values.timeout,
  threshold: values.threshold,
} : null

export function diffServiceConfig(saved: MergedServiceConfig | null, running: unknown, runningStrategy?: string | null): ServiceConfigDiff[] {
  if (!saved) return []
  const spec = running as TrellisJobSpec | null
  const group = spec?.task_groups?.[0]
  const task = group?.tasks?.[0]
  if (!group || !task) return []
  const health = task.health_check
  const beforeHealth = healthConfig(health?.type, health ?? {})
  const afterHealth = healthConfig(saved.healthCheckType, { path: saved.healthCheckPath, port: saved.healthCheckPort, command: saved.healthCheckCommand, interval: saved.healthCheckInterval * 1_000_000_000, timeout: saved.healthCheckTimeout * 1_000_000_000, threshold: saved.healthCheckThreshold })
  const rows: Array<[string, string, unknown, unknown]> = [
    ['image', 'Image', task.image, saved.image],
    ['replicas', 'Replicas', group.count, saved.replicas],
    ['cpu', 'CPU', task.resources?.cpu, saved.cpu],
    ['memory', 'Memory', task.resources?.memory, saved.memory],
    ['strategy', 'Strategy', runningStrategy ?? group.update?.strategy, saved.deploymentStrategy === 'blue_green' || saved.deploymentStrategy === 'canary' ? saved.deploymentStrategy : saved.deploymentStrategy],
    ['health', 'Health check', beforeHealth, afterHealth],
    ['secrets', 'Secret bindings', bindings(task.secrets), bindings(saved.secretBindings)],
  ]
  return diffFields(rows, task.env, task.secrets, saved.envVars, saved.secretBindings)
}

/** Compare the exact stored release to the running workload. Plain environment values are shown; secret-bound ones never are. */
export function diffJobSpecs(selected: unknown, running: unknown): ServiceConfigDiff[] {
  const before = (running as TrellisJobSpec | null)?.task_groups?.[0]
  const after = (selected as TrellisJobSpec | null)?.task_groups?.[0]
  const oldTask = before?.tasks?.[0]
  const newTask = after?.tasks?.[0]
  if (!before || !after || !oldTask || !newTask) return []
  return diffFields([
    ['image', 'Image', oldTask.image, newTask.image],
    ['replicas', 'Replicas', before.count, after.count],
    ['cpu', 'CPU', oldTask.resources?.cpu, newTask.resources?.cpu],
    ['memory', 'Memory', oldTask.resources?.memory, newTask.resources?.memory],
    ['strategy', 'Strategy', before.update, after.update],
    ['health', 'Health check', oldTask.health_check ? healthConfig(oldTask.health_check.type, oldTask.health_check) : undefined, newTask.health_check ? healthConfig(newTask.health_check.type, newTask.health_check) : undefined],
    ['secrets', 'Secret bindings', bindings(oldTask.secrets), bindings(newTask.secrets)],
    ['volumes', 'Mounts', oldTask.volumes, newTask.volumes],
    ['networking', 'Networking', oldTask.networking, newTask.networking],
    ['runtime', 'Isolation', before.runtime || 'runc', after.runtime || 'runc'],
    ['api', 'Workload API access', before.api_access, after.api_access],
    ['restart', 'Restart policy', before.restart, after.restart],
    ['constraints', 'Placement', before.constraints, after.constraints],
  ], oldTask.env, oldTask.secrets, newTask.env, newTask.secrets)
}

function environmentSide(present: boolean, secret: boolean, value: unknown): EnvironmentSide {
  if (!present) return { present, masked: false }
  if (secret || value === undefined || value === null) return { present, masked: true }
  return { present, masked: false, value: String(value) }
}

function diffFields(rows: Array<[string, string, unknown, unknown]>, runningEnv: unknown, runningSecrets: unknown, savedEnv: unknown, savedSecrets: unknown): ServiceConfigDiff[] {
  const result: ServiceConfigDiff[] = rows.filter(([, , before, after]) => !equal(before, after)).map(([key, label, before, after]) => ({
    kind: 'config', key, label, before: sorted(before ?? null) as ServiceConfigValue, after: sorted(after ?? null) as ServiceConfigValue,
    ...(RECORDED_KEYS.has(key) && before === undefined ? { beforeRecorded: false as const } : {}),
    ...(RECORDED_KEYS.has(key) && after === undefined ? { afterRecorded: false as const } : {}),
  }))
  const runningKeys = environmentKeys(runningEnv, runningSecrets)
  const savedKeys = environmentKeys(savedEnv, savedSecrets)
  for (const key of [...new Set([...runningKeys, ...savedKeys])].sort()) {
    const beforePresent = runningKeys.includes(key)
    const afterPresent = savedKeys.includes(key)
    const runningValue = (runningEnv as Record<string, unknown> | undefined)?.[key]
    const savedValue = (savedEnv as Record<string, unknown> | undefined)?.[key]
    const hasRunningSecret = bindings(runningSecrets).some((binding) => binding.target === 'env' && binding.env === key)
    const hasSavedSecret = bindings(savedSecrets).some((binding) => binding.target === 'env' && binding.env === key)
    if (beforePresent !== afterPresent || !equal(runningValue, savedValue) || hasRunningSecret !== hasSavedSecret) result.push({
      kind: 'environment', key: `env.${key}`, label: 'Environment', variable: key,
      change: !beforePresent ? 'Added' : !afterPresent ? 'Removed' : 'Changed',
      before: environmentSide(beforePresent, hasRunningSecret, runningValue), after: environmentSide(afterPresent, hasSavedSecret, savedValue),
    })
  }
  return result
}
