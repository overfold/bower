'use client'

import { useCallback, useEffect, useState } from 'react'
import { getServiceMetricsSeries } from '@/lib/actions/metrics-actions'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimeSeriesChart } from '@/components/ui/time-series-chart'
import { formatCpu, formatMemory } from '@/lib/format'
import { deploymentMarkers } from '@/lib/deploy-markers'
import type { MetricsHistory, MetricsRange } from '@/lib/metrics-series'

const RANGE_LABELS: Record<MetricsRange, { tab: string; words: string }> = {
  '1h': { tab: '1h', words: 'last hour' },
  '6h': { tab: '6h', words: 'last 6 hours' },
  '24h': { tab: '24h', words: 'last 24 hours' },
}

const REFRESH_MS = 30_000

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; series: MetricsHistory }

/**
 * CPU and memory history with deploy markers, for a whole service or, with `allocationId`, for one allocation.
 * Both read the stored samples only, so an allocation's history stays viewable after it stops.
 */
export function MetricsHistoryCharts({ serviceId, environmentId, allocationId, ranges, cpuLimit, memoryLimit }: {
  serviceId: string
  environmentId: string
  /** Narrows the history to one allocation; omit for the service total. */
  allocationId?: string
  /** Ranges the configured retention can serve; longer ones are not offered. */
  ranges: MetricsRange[]
  /** The limit for the scope shown (per-replica for an allocation, times replicas for a service), or 0 for none. */
  cpuLimit: number
  memoryLimit: number
}) {
  const [range, setRange] = useState<MetricsRange>(ranges.includes('1h') ? '1h' : ranges[0])
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchSeries() {
      try {
        const series = await getServiceMetricsSeries({ serviceId, environmentId, range, allocationId })
        if (!cancelled) setLoad({ state: 'ready', series })
      } catch (error) {
        // Keep showing earlier data across a failed refresh; only a first load surfaces the error.
        if (!cancelled) setLoad((current) => current.state === 'ready' ? current : { state: 'error', message: error instanceof Error && error.message ? error.message : 'Metrics history is unavailable.' })
      }
    }
    fetchSeries()
    const interval = window.setInterval(fetchSeries, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [serviceId, environmentId, allocationId, range, attempt])

  const selectRange = useCallback((next: string) => {
    setRange(next as MetricsRange)
    setLoad({ state: 'loading' })
  }, [])
  const retry = useCallback(() => { setLoad({ state: 'loading' }); setAttempt((value) => value + 1) }, [])

  if (!ranges.length) return null
  const words = RANGE_LABELS[range].words
  const series = load.state === 'ready' && load.series.range === range ? load.series : null
  const chartState = load.state === 'error' ? 'error' : series ? 'ready' : 'loading'
  const markers = deploymentMarkers(series?.deployments ?? [])
  const common = { rangeLabel: words, markers, state: chartState, error: load.state === 'error' ? load.message : undefined, onRetry: retry } as const

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>Usage history</SectionTitle>
          <p className="mt-0.5 text-xs text-ink-muted">{allocationId ? 'This allocation' : "Summed across this environment's allocations"}, {words}.</p>
        </div>
        <Tabs value={range} onValueChange={selectRange}>
          <TabsList aria-label="History range">
            {ranges.map((value) => <TabsTrigger key={value} value={value}>{RANGE_LABELS[value].tab}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <p className="mb-2 text-xs font-medium text-ink-muted">CPU usage</p>
          <TimeSeriesChart {...common} label="CPU usage" points={(series?.points ?? []).map((point) => ({ t: point.t, value: point.cpu, peak: point.cpuPeak }))} formatValue={formatCpu} axisUnits={[1, 1000]} limit={cpuLimit || undefined} limitLabel="CPU limit" />
        </Panel>
        <Panel className="p-4">
          <p className="mb-2 text-xs font-medium text-ink-muted">Memory usage</p>
          <TimeSeriesChart {...common} label="Memory usage" points={(series?.points ?? []).map((point) => ({ t: point.t, value: point.memory, peak: point.memoryPeak }))} formatValue={formatMemory} axisUnits={[1048576, 1073741824]} limit={memoryLimit || undefined} limitLabel="Memory limit" />
        </Panel>
      </div>
    </div>
  )
}
