'use client'

import { useEffect, useState } from 'react'
import { formatLogTimestamp, timestampTitle } from '@/lib/format'

/** Match allocation logs: local timestamps after hydration, UTC in the tooltip. */
export function DeploymentLogExcerpt({ lines }: { lines: string[] }) {
  const [local, setLocal] = useState(false)
  useEffect(() => { const frame = requestAnimationFrame(() => setLocal(true)); return () => cancelAnimationFrame(frame) }, [])
  return <pre className="mt-2 max-h-52 overflow-auto rounded bg-sunken p-3 text-xs text-ink">{lines.map((line, index) => {
    const timestamp = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/)
    return <span className="block" key={index}>{timestamp ? <><span className="text-ink-muted" title={timestampTitle(timestamp[1])}>{formatLogTimestamp(timestamp[1], local ? undefined : 'UTC') ?? timestamp[1]} </span>{timestamp[2]}</> : line}</span>
  })}</pre>
}
