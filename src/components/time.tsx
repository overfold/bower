'use client'

import { useEffect, useState } from 'react'
import { formatRelativeTime, formatTimestamp, timestampTitle, type DateValue } from '@/lib/format'

export function Time({ value, mode = 'relative' }: { value: DateValue; mode?: 'auto' | 'absolute' | 'relative' }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const first = requestAnimationFrame(update)
    const timer = setInterval(update, 60000)
    return () => { cancelAnimationFrame(first); clearInterval(timer) }
  }, [])
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return <span>—</span>
  const absolute = formatTimestamp(date, now === null ? 'UTC' : undefined)
  return <time dateTime={date.toISOString()} title={timestampTitle(date, now === null ? 'UTC' : undefined)} suppressHydrationWarning>
    {mode !== 'absolute' && now !== null ? formatRelativeTime(date, now) : absolute}
  </time>
}
