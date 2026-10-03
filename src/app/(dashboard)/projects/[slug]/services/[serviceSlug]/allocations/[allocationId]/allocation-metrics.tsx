'use client'

import { useEffect, useRef, useState } from 'react'
import { getAllocationMetricsAction } from '@/lib/actions/allocation-actions'
import { Panel } from '@/components/ui/panel'
import { formatCpu, formatMemory, formatTimestamp } from '@/lib/format'
import type { TrellisAllocationMetrics } from '@/types/trellis'

function latestTimestamp(metrics: TrellisAllocationMetrics[]) {
  const timestamps = metrics.map((item) => Date.parse(item.collected_at)).filter(Number.isFinite)
  return timestamps.length ? formatTimestamp(new Date(Math.max(...timestamps))) : '—'
}

export function AllocationMetrics({
  serviceId,
  allocationId,
  initialMetrics,
  initialError,
  cpuLimit,
  memoryLimit,
}: {
  serviceId: string
  allocationId: string
  initialMetrics: TrellisAllocationMetrics[]
  initialError: string | null
  cpuLimit: number
  memoryLimit: number
}) {
  const previousRef = useRef(initialMetrics)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [cpuMillicores, setCpuMillicores] = useState<number | null>(null)
  const [error, setError] = useState(Boolean(initialError))

  useEffect(() => {
    let cancelled = false

    async function sample() {
      try {
        const next = await getAllocationMetricsAction(serviceId, allocationId)
        if (cancelled) return
        const previousByTask = new Map(previousRef.current.map((item) => [item.task, item]))
        let cpu = 0
        let cpuSamples = 0

        for (const item of next) {
          const previous = previousByTask.get(item.task)
          if (!previous) continue
          const elapsedMs = Date.parse(item.collected_at) - Date.parse(previous.collected_at)
          const cpuDeltaNs = item.cpu_usage_nanoseconds - previous.cpu_usage_nanoseconds
          if (elapsedMs <= 0 || cpuDeltaNs < 0) continue
          const elapsedNs = elapsedMs * 1_000_000
          cpu += (cpuDeltaNs / elapsedNs) * 1000
          cpuSamples += 1
        }

        previousRef.current = next
        setMetrics(next)
        setCpuMillicores(cpuSamples > 0 ? cpu : null)
        setError(false)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    const first = window.setTimeout(sample, 2500)
    const interval = window.setInterval(sample, 5000)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(interval)
    }
  }, [allocationId, serviceId])

  const memoryBytes = metrics.reduce((total, item) => total + Math.max(0, item.memory_usage_bytes), 0)
  const taskCount = metrics.length
  const sampledAt = latestTimestamp(metrics)
  const cpuPercent = cpuMillicores === null || !cpuLimit ? 0 : Math.min(100, Math.max(0, cpuMillicores / cpuLimit * 100))
  const memoryPercent = !memoryLimit ? 0 : Math.min(100, memoryBytes / memoryLimit * 100)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">CPU usage</p>
            {cpuMillicores === null && taskCount ? <div className="mt-3 h-7 w-40 animate-pulse rounded bg-surface-raised" aria-label="Sampling CPU usage" /> : <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">{cpuMillicores === null ? (error ? 'Unavailable' : 'No samples') : <>{formatCpu(Math.max(0, cpuMillicores))}{cpuLimit ? ` / ${formatCpu(cpuLimit)}` : ''}</>}</p>}
          </div>
        </div>
        {cpuLimit ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-brand-500" style={{ width: `${cpuPercent}%` }} /></div> : null}
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? (taskCount ? 'Latest sample unavailable; showing last known data.' : initialError || 'Metrics unavailable; retrying automatically.') : taskCount ? `Across ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} · sampled ${sampledAt}` : 'No metrics samples returned; retrying automatically.'}
        </p>
      </Panel>

      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">Memory usage</p>
            <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">{taskCount ? <>{formatMemory(memoryBytes)}{memoryLimit ? ` / ${formatMemory(memoryLimit)}` : ''}</> : error ? 'Unavailable' : 'No samples'}</p>
          </div>
        </div>
        {memoryLimit ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-brand-500" style={{ width: `${memoryPercent}%` }} /></div> : null}
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? (taskCount ? 'Latest sample unavailable; showing last known data.' : initialError || 'Metrics unavailable; retrying automatically.') : taskCount ? `Current resident usage · sampled ${sampledAt}` : 'No metrics samples returned; retrying automatically.'}
        </p>
      </Panel>
    </div>
  )
}
