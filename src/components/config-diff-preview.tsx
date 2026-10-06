import { Chip } from '@/components/status'
import { deploymentImageTag, formatCpu, formatMemory } from '@/lib/format'
import type { EnvironmentSide, ServiceConfigDiff } from '@/lib/service-config-diff'

const diffGrid = 'grid grid-cols-[minmax(6rem,0.7fr)_1fr_1fr] gap-3'

/**
 * Before/after table for deploy and rollback dialogs. `flush` makes it span the dialog edge to edge
 * (no outer border): the dialog header, footer, or panel edges frame it. Inside a dialog, put it in
 * `<DialogBody flush>`, which also removes the alert dialog's gap above and below.
 */
export function ConfigDiffPreview({ changes, afterLabel, beforeLabel = 'Running', flush = false }: { changes: ServiceConfigDiff[]; afterLabel: string; beforeLabel?: string; flush?: boolean }) {
  if (!changes.length) return <p className="px-4 py-3 text-sm text-ink-muted sm:px-5">No configuration differences.</p>
  return <div className={flush ? undefined : 'overflow-hidden rounded-md border border-line'}>
    <div className={`${diffGrid} bg-sunken px-4 py-2 text-xs font-semibold text-ink-muted sm:px-5`}><span>Field</span><span>{beforeLabel}</span><span>{afterLabel}</span></div>
    {changes.map((change) => <div key={change.key} className={`${diffGrid} border-t border-line px-4 py-2 text-sm sm:px-5`}>{change.kind === 'environment' ? <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="break-all font-mono text-xs text-ink">{change.variable}</span><Chip tone="neutral">{change.change}</Chip></span>
      <EnvironmentValue side={change.before} muted />
      <EnvironmentValue side={change.after} />
    </> : <>
      <span className="font-medium text-ink">{change.label}</span>
      <span className={`min-w-0 break-words text-xs text-ink-muted ${change.key === 'image' ? 'font-mono' : ''}`}>{change.beforeRecorded === false ? <NotRecorded /> : formatDiffValue(change, change.before)}</span>
      <span className={`min-w-0 break-words text-xs text-ink ${change.key === 'image' ? 'font-mono' : ''}`}>{change.afterRecorded === false ? <NotRecorded /> : formatDiffValue(change, change.after)}</span>
    </>}</div>)}
  </div>
}

/** Absent from the stored release: unknown, not an instruction to remove it. */
function NotRecorded() {
  return <span className="text-ink-muted" title="This release did not record a value, so the dialog cannot say what it would change."><span aria-hidden>—</span><span className="sr-only">Not recorded</span></span>
}

function EnvironmentValue({ side, muted = false }: { side: EnvironmentSide; muted?: boolean }) {
  const tone = muted ? 'text-ink-muted' : 'text-ink'
  if (!side.present) return <span className="text-xs text-ink-muted">Not set</span>
  if (side.masked) return <span className={`font-mono text-xs ${tone}`} title="Bound from a secret; the value is never shown.">••••••••</span>
  return <span className={`min-w-0 break-all font-mono text-xs ${tone}`}>{side.value === '' ? <span className="font-sans text-ink-muted">Empty</span> : side.value}</span>
}

function formatDiffValue(change: Extract<ServiceConfigDiff, { kind: 'config' }>, value: typeof change.before) {
  if (value == null || value === '') return 'None'
  if (change.key === 'image') return deploymentImageTag(String(value))
  if (change.key === 'cpu') return formatCpu(Number(value))
  if (change.key === 'memory') return formatMemory(Number(value))
  if (change.key === 'health' && typeof value === 'object' && !Array.isArray(value)) {
    const health = value as Record<string, ServiceConfigDiffValue>
    const cadence = `every ${Number(health.interval) / 1e9}s · ${Number(health.timeout) / 1e9}s timeout · ${health.threshold} failures`
    if (health.type === 'http') return `HTTP ${health.path ?? '/'}${health.port ? ` on port ${health.port}` : ''} · ${cadence}`
    if (health.type === 'tcp') return `TCP port ${health.port} · ${cadence}`
    return `Script ${Array.isArray(health.command) ? health.command.join(' ') : health.command} · ${cadence}`
  }
  if (change.key === 'secrets' && Array.isArray(value)) return value.map((item) => {
    const binding = item as Record<string, ServiceConfigDiffValue>
    return `${binding.name} → ${binding.target === 'env' ? binding.env : binding.path}`
  }).join(', ') || 'None'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

type ServiceConfigDiffValue = Extract<ServiceConfigDiff, { kind: 'config' }>['before']

