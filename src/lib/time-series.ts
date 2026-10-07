export type TimeSeriesPoint = { t: number; value: number | null; peak?: number | null }

/** Consecutive index ranges of non-null values. A null breaks the line: nothing is interpolated across a gap. */
export function seriesRuns(points: TimeSeriesPoint[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = []
  let start = -1
  points.forEach((point, index) => {
    if (point.value !== null && Number.isFinite(point.value)) {
      if (start < 0) start = index
    } else if (start >= 0) {
      runs.push({ start, end: index - 1 })
      start = -1
    }
  })
  if (start >= 0) runs.push({ start, end: points.length - 1 })
  return runs
}

/** Rounds up to 1, 2, 2.5, 5 or 10 times a power of ten, so the axis ends on a readable value. */
export function niceCeil(value: number, units: number[] = [1]): number {
  if (!(value > 0)) return units[0]
  // Count in the largest unit the value reaches (1 GB, not 1024 MB), so binary quantities still get round axis labels.
  const unit = [...units].sort((a, b) => b - a).find((candidate) => candidate <= value) ?? Math.min(...units)
  return niceFraction(value / unit) * unit
}

function niceFraction(value: number): number {
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * exponent
}

export type SeriesGeometry = { line: string; area: string }

/** SVG path data in a 0..width by 0..height box, y growing downward, for each run of data. */
export function seriesGeometry(points: TimeSeriesPoint[], max: number, width = 1000, height = 100): SeriesGeometry {
  const x = (index: number) => points.length > 1 ? index / (points.length - 1) * width : width / 2
  const y = (value: number) => height - Math.min(max, Math.max(0, value)) / max * height
  const round = (n: number) => Math.round(n * 100) / 100
  let line = ''
  let area = ''
  for (const { start, end } of seriesRuns(points)) {
    const coords = points.slice(start, end + 1).map((point, offset) => `${round(x(start + offset))} ${round(y(point.value as number))}`)
    // A lone sample is a zero-length segment: with round caps it still draws as a dot.
    line += start === end ? `M${coords[0]} h0 ` : `M${coords.join(' L')} `
    if (start !== end) area += `M${round(x(start))} ${height} L${coords.join(' L')} L${round(x(end))} ${height} Z `
  }
  return { line: line.trim(), area: area.trim() }
}

export function summarizeSeries({ label, rangeLabel, points, format, limit, limitLabel = 'Limit' }: {
  label: string
  rangeLabel: string
  points: TimeSeriesPoint[]
  format: (value: number) => string
  limit?: number
  limitLabel?: string
}): string {
  const values = points.flatMap((point) => point.value === null ? [] : [point.value])
  if (!values.length) return `${label} over the ${rangeLabel}: no samples yet.`
  const latest = [...points].reverse().find((point) => point.value !== null)?.value as number
  const gaps = seriesRuns(points).length - 1 + (points[0]?.value === null ? 1 : 0) + (points.at(-1)?.value === null ? 1 : 0)
  const parts = [`latest ${format(latest)}`, `lowest ${format(Math.min(...values))}`, `highest ${format(Math.max(...values))}`]
  if (gaps > 0) parts.push(`${gaps} ${gaps === 1 ? 'gap' : 'gaps'} without data`)
  if (limit) parts.push(`${limitLabel.toLowerCase()} ${format(limit)}${values.some((value) => value > limit) ? ', exceeded' : ''}`)
  return `${label} over the ${rangeLabel}: ${parts.join(', ')}.`
}
