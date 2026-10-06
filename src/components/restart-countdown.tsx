'use client'

import { useEffect, useState } from 'react'
import { Time } from '@/components/time'

/** "next attempt in 30s" (or just "in 30s" when `bare`), ticking each second; "restarting" once the time has passed (never "0s"). */
export function RestartCountdown({ at, bare }: { at: string; bare?: boolean }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const first = requestAnimationFrame(update)
    const timer = setInterval(update, 1000)
    return () => { cancelAnimationFrame(first); clearInterval(timer) }
  }, [])
  const target = Date.parse(at)
  if (!Number.isFinite(target)) return <span>restart pending</span>
  if (now !== null && target <= now) return <span>restarting</span>
  return bare ? <Time value={at} mode="live" /> : <span>next attempt <Time value={at} mode="live" /></span>
}
