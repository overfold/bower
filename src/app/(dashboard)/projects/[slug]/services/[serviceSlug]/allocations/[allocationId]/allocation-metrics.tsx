'use client'

import { useEffect, useRef, useState } from 'react'
import { Cpu, MemoryStick } from 'lucide-react'
import { getAllocationMetricsAction } from '@/lib/actions/allocation-actions'
import { Panel } from '@/components/ui/panel'
import type { TrellisAllocationMetrics } from '@/types/trellis'

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`
}

function latestTimestamp(metrics: TrellisAllocationMetrics[]) {
  const timestamps = metrics.map((item) => Date.parse(item.collected_at)).filter(Number.isFinite)
  return timestamps.length ? new Date(Math.max(...timestamps)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
}

export function AllocationMetrics({
  serviceId,
  allocationId,
  initialMetrics,
}: {
  serviceId: string
  allocationId: string
  initialMetrics: TrellisAllocationMetrics[]
}) {
  const previousRef = useRef(initialMetrics)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [cpuMillicores, setCpuMillicores] = useState<number | null>(null)
  const [error, setError] = useState(false)

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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">CPU usage</p>
            <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">
              {cpuMillicores === null ? 'Sampling…' : `${Math.max(0, cpuMillicores).toFixed(cpuMillicores >= 100 ? 0 : 1)} mCPU`}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-ink-muted">
            <Cpu className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? 'Latest sample unavailable; showing last known data.' : `Across ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} · sampled ${sampledAt}`}
        </p>
      </Panel>

      <Panel className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-muted">Memory usage</p>
            <p className="nums mt-1.5 text-2xl font-semibold tracking-tight text-ink">{taskCount ? formatBytes(memoryBytes) : 'Unavailable'}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-ink-muted">
            <MemoryStick className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xs text-ink-muted">
          {error ? 'Latest sample unavailable; showing last known data.' : `Current resident usage reported by Trellis · sampled ${sampledAt}`}
        </p>
      </Panel>
    </div>
  )
}
