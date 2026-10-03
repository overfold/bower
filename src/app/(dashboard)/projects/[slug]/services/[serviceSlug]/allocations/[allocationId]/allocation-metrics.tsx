'use client'

import { useEffect, useRef, useState } from 'react'
import { getAllocationMetricsAction } from '@/lib/actions/allocation-actions'
import { Panel } from '@/components/ui/panel'
import { formatCpu, formatMemory } from '@/lib/format'
import { Time } from '@/components/time'
import type { TrellisAllocationMetrics } from '@/types/trellis'

function usageColor(percent: number) {
  if (percent >= 100) return 'bg-danger-500'
  if (percent >= 85) return 'bg-warn-500'
  return 'bg-brand-500'
}

function latestTimestamp(metrics: TrellisAllocationMetrics[]) {
  const timestamps = metrics.map((item) => Date.parse(item.collected_at)).filter(Number.isFinite)
  return timestamps.length ? new Date(Math.max(...timestamps)) : null
}

export function AllocationMetrics({
  serviceId,
  allocationId,
  allocationIds,
  initialMetrics,
  initialError,
  cpuLimit,
  memoryLimit,
}: {
  serviceId: string
  allocationId?: string
  allocationIds?: string[]
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
        const next = (await Promise.all((allocationIds ?? (allocationId ? [allocationId] : [])).map((id) => getAllocationMetricsAction(serviceId, id)))).flat()
        if (cancelled) return
        const previousByTask = new Map(previousRef.current.map((item) => [`${item.allocation_id}/${item.task}`, item]))
        let cpu = 0
        let cpuSamples = 0

        for (const item of next) {
          const previous = previousByTask.get(`${item.allocation_id}/${item.task}`)
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
  }, [allocationId, allocationIds, serviceId])

  const memoryBytes = metrics.reduce((total, item) => total + Math.max(0, item.memory_usage_bytes), 0)
  const taskCount = metrics.length
  const sampledAt = latestTimestamp(metrics)
  const cpuPercent = cpuMillicores === null || !cpuLimit ? 0 : Math.max(0, cpuMillicores / cpuLimit * 100)
  const memoryPercent = !memoryLimit ? 0 : Math.max(0, memoryBytes / memoryLimit * 100)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">CPU usage</p>
            {cpuMillicores === null && taskCount ? <p className="mt-2 inline-block animate-pulse rounded bg-sunken px-2 py-1 text-sm text-ink-muted" aria-label="Sampling CPU usage">Measuring…</p> : <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">{cpuMillicores === null ? (error ? 'Unavailable' : 'No samples') : <>{formatCpu(Math.max(0, cpuMillicores))}{cpuLimit ? ` / ${formatCpu(cpuLimit)}` : ''}</>}</p>}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-label="CPU usage"><div className={`h-full rounded-full ${usageColor(cpuPercent)}`} style={{ width: `${Math.min(100, cpuPercent)}%` }} /></div>
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? (taskCount ? 'Latest sample unavailable; showing last known data.' : initialError || 'Metrics unavailable; retrying automatically.') : taskCount ? <>Across {taskCount} {taskCount === 1 ? 'task' : 'tasks'} · Updated <Time value={sampledAt} mode="live" /></> : 'No metrics samples returned; retrying automatically.'}
        </p>
      </Panel>

      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">Memory usage</p>
            <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">{taskCount ? <>{formatMemory(memoryBytes)}{memoryLimit ? ` / ${formatMemory(memoryLimit)}` : ''}</> : error ? 'Unavailable' : 'No samples'}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-label="Memory usage"><div className={`h-full rounded-full ${usageColor(memoryPercent)}`} style={{ width: `${Math.min(100, memoryPercent)}%` }} /></div>
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? (taskCount ? 'Latest sample unavailable; showing last known data.' : initialError || 'Metrics unavailable; retrying automatically.') : taskCount ? <>Current resident usage · Updated <Time value={sampledAt} mode="live" /></> : 'No metrics samples returned; retrying automatically.'}
        </p>
      </Panel>
    </div>
  )
}
