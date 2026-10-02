'use client'

import { useEffect, useState } from 'react'
import { formatRelativeTime, formatTimestamp, type DateValue } from '@/lib/format'

export function Time({ value, mode = 'auto' }: { value: DateValue; mode?: 'auto' | 'absolute' }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const first = requestAnimationFrame(update)
    const timer = setInterval(update, 60000)
    return () => { cancelAnimationFrame(first); clearInterval(timer) }
  }, [])
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return <span className="text-xs text-ink-muted">—</span>
  const absolute = formatTimestamp(date)
  const age = now === null ? Infinity : now - date.getTime()
  return <time className="text-xs text-ink-muted" dateTime={date.toISOString()} title={absolute} suppressHydrationWarning>
    {mode === 'auto' && now !== null && age >= 0 && age < 7 * 86400000 ? formatRelativeTime(date, now) : absolute}
  </time>
}
