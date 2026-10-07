'use client'

import { useId, useState } from 'react'
import { Time } from '@/components/time'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { niceCeil, seriesGeometry, summarizeSeries, type TimeSeriesPoint } from '@/lib/time-series'

export type { TimeSeriesPoint }

export type TimeSeriesChartProps = {
  /** Series name, used in the accessible summary ("CPU usage"). */
  label: string
  /** The span in words, used in the summary ("last hour"). */
  rangeLabel: string
  points: TimeSeriesPoint[]
  formatValue: (value: number) => string
  /** Optional reference line, in the same unit as the values. */
  limit?: number
  limitLabel?: string
  /** Unit sizes the y-axis may count in (default 1), e.g. 1000 millicores per core or MiB and GiB for bytes. */
  axisUnits?: number[]
  state?: 'ready' | 'loading' | 'error'
  error?: string
  onRetry?: () => void
  className?: string
}

const PLOT_HEIGHT = 'h-40'

/**
 * Hand-rolled SVG line/area chart for one metric over time. A null value is a
 * gap: the line breaks and is never interpolated across it. Hover or focus the
 * plot (arrow keys, Home, End, Escape) to read one bucket.
 */
export function TimeSeriesChart({ label, rangeLabel, points, formatValue, limit, limitLabel = 'Limit', axisUnits, state = 'ready', error, onRetry, className }: TimeSeriesChartProps) {
  const readoutId = useId()
  const [active, setActive] = useState<number | null>(null)

  if (state === 'loading') return <Skeleton className={cn(PLOT_HEIGHT, 'w-full', className)} aria-label={`Loading ${label} history`} />
  if (state === 'error') {
    return (
      <div className={cn(PLOT_HEIGHT, 'flex items-center', className)}>
        <InlineNotice tone="danger" className="w-full" action={onRetry ? <Button variant="default" size="sm" onClick={onRetry}>Retry</Button> : undefined}>
          {error || `${label} history is unavailable.`}
        </InlineNotice>
      </div>
    )
  }

  const populated = points.some((point) => point.value !== null)
  if (!populated) {
    return (
      <div className={cn(PLOT_HEIGHT, 'flex items-center justify-center rounded-lg border border-dashed border-line bg-sunken px-4 text-center text-sm text-ink-muted', className)}>
        No samples yet
      </div>
    )
  }

  const dataMax = Math.max(0, ...points.map((point) => point.value ?? 0))
  const max = niceCeil(Math.max(dataMax, limit ?? 0), axisUnits)
  const exceeded = Boolean(limit) && dataMax > (limit as number)
  const { line, area } = seriesGeometry(points, max)
  const lastIndex = points.length - 1
  const latestIndex = points.reduce((found, point, index) => point.value === null ? found : index, -1)
  const shown = active ?? latestIndex
  const shownPoint = points[shown]
  const limitTop = limit ? 100 - Math.min(max, limit) / max * 100 : null
  const summary = summarizeSeries({ label, rangeLabel, points, format: formatValue, limit, limitLabel })
  const left = (index: number) => lastIndex > 0 ? index / lastIndex * 100 : 50

  const move = (next: number) => setActive(Math.min(lastIndex, Math.max(0, next)))
  const onKeyDown = (event: React.KeyboardEvent) => {
    const from = active ?? latestIndex
    if (event.key === 'ArrowLeft') move(from - 1)
    else if (event.key === 'ArrowRight') move(from + 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(lastIndex)
    else if (event.key === 'Escape') setActive(null)
    else return
    event.preventDefault()
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width > 0) move(Math.round((event.clientX - box.left) / box.width * lastIndex))
  }

  return (
    <figure className={cn('m-0', className)}>
      <div className="flex min-h-9 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p id={readoutId} className="nums min-w-0 text-xs text-ink-muted" aria-live={active === null ? 'off' : 'polite'}>
          <span className="font-medium text-ink-soft">{active === null ? 'Latest' : <Time value={new Date(shownPoint.t)} mode="absolute" />}</span>
          {' · '}
          {shownPoint.value === null
            ? 'No data'
            : <><span className="font-mono text-ink">{formatValue(shownPoint.value)}</span>{shownPoint.peak != null ? <> · peak <span className="font-mono text-ink">{formatValue(shownPoint.peak)}</span></> : null}</>}
        </p>
        {limit ? (
          <p className="flex items-center gap-1.5 text-2xs text-ink-muted">
            <span className={cn('h-0 w-4 border-t-2 border-dashed', exceeded ? 'border-danger-500' : 'border-warn-500')} aria-hidden="true" />
            {limitLabel} <span className="font-mono">{formatValue(limit)}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <div className={cn('relative w-16 shrink-0 whitespace-nowrap font-mono text-2xs text-ink-muted', PLOT_HEIGHT)} aria-hidden="true">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatValue(max)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatValue(max / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatValue(0)}</span>
        </div>
        <div
          role="group"
          tabIndex={0}
          aria-label={summary}
          aria-describedby={readoutId}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? latestIndex)}
          onBlur={() => setActive(null)}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          className={cn('relative min-w-0 flex-1 touch-pan-y rounded-sm border-b border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface', PLOT_HEIGHT)}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 50, 100].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            <path d={area} className="fill-brand-500 opacity-10" />
            {limitTop !== null ? <line x1="0" x2="1000" y1={limitTop} y2={limitTop} className={exceeded ? 'stroke-danger-500' : 'stroke-warn-500'} strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : null}
            <path d={line} fill="none" className="stroke-brand-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {active !== null ? (
            <>
              <span className="absolute inset-y-0 w-px bg-line-strong transition-opacity motion-reduce:transition-none" style={{ left: `${left(active)}%` }} aria-hidden="true" />
              {shownPoint.value !== null ? <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand-500" style={{ left: `${left(active)}%`, top: `${100 - Math.min(max, shownPoint.value) / max * 100}%` }} aria-hidden="true" /> : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pl-[4.5rem] text-2xs text-ink-muted" aria-hidden="true">
        <Time value={new Date(points[0].t)} mode="relative" />
        <span>Now</span>
      </div>
    </figure>
  )
}
