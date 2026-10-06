'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, formatRelativeTime, formatTimestamp, timestampTitle, type DateValue } from '@/lib/format'

export function Time({ value, mode = 'relative' }: { value: DateValue; mode?: 'auto' | 'absolute' | 'relative' | 'live' }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const first = requestAnimationFrame(update)
    const timer = setInterval(update, mode === 'live' ? 1000 : 60000)
    return () => { cancelAnimationFrame(first); clearInterval(timer) }
  }, [mode])
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return <span>—</span>
  const absolute = formatTimestamp(date, now === null ? 'UTC' : undefined)
  const ageSeconds = now === null ? null : Math.max(0, Math.floor((now - date.getTime()) / 1000))
  const remainingSeconds = now === null ? null : (date.getTime() - now) / 1000
  return <time dateTime={date.toISOString()} title={timestampTitle(date, now === null ? 'UTC' : undefined)} suppressHydrationWarning>
    {mode === 'live' && remainingSeconds !== null && remainingSeconds > 0 ? formatCountdown(remainingSeconds) : mode === 'live' && ageSeconds !== null && ageSeconds < 60 ? `${ageSeconds}s ago` : mode !== 'absolute' && now !== null ? formatRelativeTime(date, now) : absolute}
  </time>
}
