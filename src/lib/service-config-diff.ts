import type { MergedServiceConfig } from '@/lib/queries'
import type { TrellisJobSpec } from '@/types/trellis'

export type ServiceConfigDiff = { key: string; label: string; before: string; after: string }

const display = (value: unknown) => value == null || value === '' ? 'None' : typeof value === 'object' ? JSON.stringify(value) : String(value)

const sorted = (value: unknown): unknown => Array.isArray(value)
  ? value.map(sorted).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]))
    : value
const equal = (a: unknown, b: unknown) => JSON.stringify(sorted(a ?? null)) === JSON.stringify(sorted(b ?? null))
const bindings = (value: unknown) => Array.isArray(value) ? value.map(({ name, target, env, path }) => ({ name, target, ...(env ? { env } : {}), ...(path ? { path } : {}) })) : []
const maskedEnv = (env: unknown, secrets: unknown) => {
  const result: Record<string, string> = { ...((env && typeof env === 'object' && !Array.isArray(env)) ? env as Record<string, string> : {}) }
  for (const binding of bindings(secrets)) if (binding.target === 'env' && binding.env) result[binding.env] = '••••••••'
  return result
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
  const rows: Array<[string, string, unknown, unknown]> = [
    ['image', 'Image', task.image, saved.image],
    ['replicas', 'Replicas', group.count, saved.replicas],
    ['cpu', 'CPU', task.resources?.cpu, saved.cpu],
    ['memory', 'Memory', task.resources?.memory, saved.memory],
    ['strategy', 'Strategy', runningStrategy ?? group.update?.strategy, saved.deploymentStrategy === 'blue_green' || saved.deploymentStrategy === 'canary' ? saved.deploymentStrategy : saved.deploymentStrategy],
    ['health', 'Health check', healthConfig(health?.type, health ?? {}), healthConfig(saved.healthCheckType, { path: saved.healthCheckPath, port: saved.healthCheckPort, command: saved.healthCheckCommand, interval: saved.healthCheckInterval * 1_000_000_000, timeout: saved.healthCheckTimeout * 1_000_000_000, threshold: saved.healthCheckThreshold })],
    ['secrets', 'Secret bindings', bindings(task.secrets), bindings(saved.secretBindings)],
    ['env', 'Environment', maskedEnv(task.env, task.secrets), maskedEnv(saved.envVars, saved.secretBindings)],
  ]
  return rows.filter(([, , before, after]) => !equal(before, after)).map(([key, label, before, after]) => ({ key, label, before: display(sorted(before)), after: display(sorted(after)) }))
}
