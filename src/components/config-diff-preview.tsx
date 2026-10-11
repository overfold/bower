'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/status'
import { deploymentImageTag, formatCpu, formatMemory } from '@/lib/format'
import type { EnvironmentSide, ServiceConfigDiff } from '@/lib/service-config-diff'

const diffGrid = 'grid grid-cols-[minmax(6rem,0.7fr)_1fr_1fr] gap-3'

/** Before/after table for deploy and rollback dialogs and the deployment page. */
export function ConfigDiffPreview({ changes }: { changes: ServiceConfigDiff[] }) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  if (!changes.length) return <p className="text-sm text-ink-muted">No configuration differences.</p>
  return <div className="overflow-hidden rounded-md border border-line">
    <div className={`${diffGrid} bg-sunken px-3 py-2 text-xs font-semibold text-ink-muted`}><span>Field</span><span>Before</span><span>After</span></div>
    {changes.map((change) => <div key={change.key} className={`${diffGrid} border-t border-line px-3 py-2 text-sm`}>{change.kind === 'environment' ? <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="break-all font-mono text-xs text-ink">{change.variable}</span><Chip tone="neutral">{change.change}</Chip>
        {[change.before, change.after].some((side) => side.present && !side.masked) ? <Button type="button" variant="ghost" size="sm" aria-label={`${revealed.has(change.key) ? 'Hide' : 'Reveal'} ${change.variable}`} aria-pressed={revealed.has(change.key)} onClick={() => setRevealed((current) => { const next = new Set(current); if (next.has(change.key)) next.delete(change.key); else next.add(change.key); return next })}>{revealed.has(change.key) ? 'Hide' : 'Reveal'}</Button> : null}
      </span>
      <EnvironmentValue side={change.before} revealed={revealed.has(change.key)} muted />
      <EnvironmentValue side={change.after} revealed={revealed.has(change.key)} />
    </> : <>
      <span className="font-medium text-ink">{change.label}</span>
      <span className={`min-w-0 break-words text-xs text-ink-muted ${change.key === 'image' ? 'font-mono' : ''}`}>{change.beforeRecorded === false ? <NotRecorded /> : formatDiffValue(change, change.before)}</span>
      <span className={`min-w-0 break-words text-xs text-ink ${change.key === 'image' ? 'font-mono' : ''}`}>{change.afterRecorded === false ? <NotRecorded /> : formatDiffValue(change, change.after)}</span>
    </>}</div>)}
  </div>
}

/** Absent from the stored release: unknown, not an instruction to remove it. */
function NotRecorded() {
  return <span className="text-ink-muted" title="This release did not record a value, so the dialog cannot say what it would change.">Not set</span>
}

function EnvironmentValue({ side, revealed, muted = false }: { side: EnvironmentSide; revealed: boolean; muted?: boolean }) {
  const tone = muted ? 'text-ink-muted' : 'text-ink'
  if (!side.present) return <span className="text-xs text-ink-muted">Not set</span>
  return <span className={`min-w-0 break-all font-mono text-xs ${tone}`}>
    {revealed && !side.masked ? side.value === '' ? <span className="font-sans text-ink-muted">Empty</span> : side.value : '••••••••'}
    {side.masked ? <Lock className="ml-1 inline size-3" aria-label="Write-only value" /> : null}
  </span>
}

function formatDiffValue(change: Extract<ServiceConfigDiff, { kind: 'config' }>, value: typeof change.before) {
  if (value == null || value === '') return 'Not set'
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
  }).join(', ') || 'Not set'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

type ServiceConfigDiffValue = Extract<ServiceConfigDiff, { kind: 'config' }>['before']
