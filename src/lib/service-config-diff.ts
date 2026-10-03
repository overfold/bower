import type { MergedServiceConfig } from '@/lib/queries'
import type { TrellisJobSpec } from '@/types/trellis'

export type ServiceConfigValue = string | number | boolean | null | ServiceConfigValue[] | { [key: string]: ServiceConfigValue }
export type ServiceConfigDiff = {
  kind: 'config'
  key: string
  label: string
  before: ServiceConfigValue
  after: ServiceConfigValue
} | {
  kind: 'environment'
  key: string
  label: 'Environment'
  variable: string
  change: 'Added' | 'Changed' | 'Removed'
  before: { present: boolean; masked: true }
  after: { present: boolean; masked: true }
}

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
  const result: ServiceConfigDiff[] = rows.filter(([, , before, after]) => !equal(before, after)).map(([key, label, before, after]) => ({ kind: 'config', key, label, before: sorted(before ?? null) as ServiceConfigValue, after: sorted(after ?? null) as ServiceConfigValue }))
  const runningKeys = environmentKeys(task.env, task.secrets)
  const savedKeys = environmentKeys(saved.envVars, saved.secretBindings)
  for (const key of [...new Set([...runningKeys, ...savedKeys])].sort()) {
    const beforePresent = runningKeys.includes(key)
    const afterPresent = savedKeys.includes(key)
    const runningValue = (task.env as Record<string, unknown> | undefined)?.[key]
    const savedValue = (saved.envVars as Record<string, unknown> | undefined)?.[key]
    const hasRunningSecret = bindings(task.secrets).some((binding) => binding.target === 'env' && binding.env === key)
    const hasSavedSecret = bindings(saved.secretBindings).some((binding) => binding.target === 'env' && binding.env === key)
    if (beforePresent !== afterPresent || !equal(runningValue, savedValue) || hasRunningSecret !== hasSavedSecret) result.push({
      kind: 'environment', key: `env.${key}`, label: 'Environment', variable: key,
      change: !beforePresent ? 'Added' : !afterPresent ? 'Removed' : 'Changed',
      before: { present: beforePresent, masked: true }, after: { present: afterPresent, masked: true },
    })
  }
  return result
}
