'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

const W = 800
const H = 1000
const LATTICE_PITCH = 70
const SAMPLE_STEP = 26
const VINE_TIMING_RATE = 0.006

const GROWTH_TOTAL_MS = 60 * 60 * 1000
const GROWTH_FAST_START_MS = 5 * 60 * 1000
const GROWTH_FAST_START_PROGRESS = 0.1
const GROWTH_TICK_MS = 1000
const GROWTH_PERSIST_MS = 5000
const GROWTH_STORAGE_KEY = 'bower:auth-vine-growth-ms:v1'

const RAIN_ACTIVE_WINDOW_MS = 90 * 1000
const RAIN_FIRST_AFTER_MS = 12 * 60 * 1000
const RAIN_GAP_MIN_MS = 12 * 60 * 1000
const RAIN_GAP_MAX_MS = 20 * 60 * 1000
const RAIN_DURATION_MS = 45 * 1000

type Pt = [number, number]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(0x76696e65)
function between(lo: number, hi: number) {
  return lo + rng() * (hi - lo)
}

function clamp(value: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, value))
}

function growthProgress(elapsedMs: number) {
  const elapsed = clamp(elapsedMs, 0, GROWTH_TOTAL_MS)
  if (elapsed <= GROWTH_FAST_START_MS) {
    return (elapsed / GROWTH_FAST_START_MS) * GROWTH_FAST_START_PROGRESS
  }

  const remainingElapsed = elapsed - GROWTH_FAST_START_MS
  const remainingDuration = GROWTH_TOTAL_MS - GROWTH_FAST_START_MS
  return (
    GROWTH_FAST_START_PROGRESS +
    (remainingElapsed / remainingDuration) * (1 - GROWTH_FAST_START_PROGRESS)
  )
}

function unit(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [dx / l, dy / l]
}

function deg(v: Pt) {
  return (Math.atan2(v[1], v[0]) * 180) / Math.PI
}

function catmullRom(pts: Pt[]): string {
  if (pts.length < 2) return ''
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d +=
      ' C' +
      (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) +
      ' ' +
      (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
      ' ' +
      (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) +
      ' ' +
      (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
      ' ' +
      p2[0].toFixed(1) +
      ' ' +
      p2[1].toFixed(1)
  }
  return d
}

interface Vine {
  id: string
  d: string
  len: number
  width: number
  delay: number
  dur: number
  tip: Pt
  tipAngle: number
  tipFlip: boolean
}

interface Corridor {
  cx: number
  height: number
  amp: number
  cycles: number
  phase: number
  drift: number
}

interface RainDrop {
  id: string
  x: number
  startY: number
  len: number
  slant: number
  duration: number
  delay: number
  opacity: number
}

const CORRIDORS: Corridor[] = [
  { cx: 120, height: 0.88, amp: 26, cycles: 3.4, phase: 0.2, drift: 22 },
  { cx: 310, height: 0.64, amp: 20, cycles: 2.4, phase: 1.9, drift: -18 },
  { cx: 500, height: 0.80, amp: 24, cycles: 3.0, phase: 0.9, drift: 20 },
  { cx: 690, height: 0.52, amp: 18, cycles: 2.0, phase: 2.6, drift: -16 },
]

const LATTICE_DUR = 2.1

function buildVine(c: Corridor, delay: number, idx: number): Vine {
  const climb = H * c.height
  const n = Math.max(4, Math.round(climb / SAMPLE_STEP))
  const pts: Pt[] = []
  let wobble = 0

  for (let i = 0; i <= n; i++) {
    const t = i / n
    wobble += between(-1.6, 1.6)
    wobble = Math.max(-6, Math.min(6, wobble))
    pts.push([
      c.cx +
        Math.sin(c.phase + t * c.cycles * Math.PI * 2) * c.amp * (0.55 + t * 0.45) +
        c.drift * t +
        wobble,
      H - climb * t,
    ])
  }

  let len = 0
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])

  const tip = pts[pts.length - 1]
  const tipTan = unit(pts[pts.length - 2], tip)

  return {
    id: 'v' + idx,
    d: catmullRom(pts),
    len: len * 1.04,
    width: between(2.1, 2.7),
    delay,
    dur: climb * VINE_TIMING_RATE,
    tip,
    tipAngle: deg(tipTan),
    tipFlip: tipTan[0] > 0,
  }
}

const VINES: Vine[] = (() => {
  let t = LATTICE_DUR
  return CORRIDORS.map((c, i) => {
    const v = buildVine(c, t, i)
    t = v.delay + v.dur + between(0.4, 1.1)
    return v
  })
})()

const VINE_TIMELINE_START = VINES[0]?.delay ?? 0
const VINE_TIMELINE_END = VINES.reduce(
  (end, vine) => Math.max(end, vine.delay + vine.dur),
  VINE_TIMELINE_START + 1,
)

function localVineProgress(vine: Vine, progress: number) {
  const span = VINE_TIMELINE_END - VINE_TIMELINE_START
  const start = (vine.delay - VINE_TIMELINE_START) / span
  const end = (vine.delay + vine.dur - VINE_TIMELINE_START) / span
  return clamp((progress - start) / Math.max(end - start, 0.001))
}

const RAIL_N = Math.ceil((W + H) / LATTICE_PITCH)
const DR = Array.from(
  { length: RAIL_N },
  (_, i) => (i - Math.ceil(H / LATTICE_PITCH)) * LATTICE_PITCH,
)
const UR = Array.from({ length: RAIL_N }, (_, i) => i * LATTICE_PITCH)

const rainRng = mulberry32(0x7261696e)
function rainBetween(lo: number, hi: number) {
  return lo + rainRng() * (hi - lo)
}

const RAIN_DROPS: RainDrop[] = Array.from({ length: 34 }, (_, i) => ({
  id: 'r' + i,
  x: rainBetween(-20, W + 20),
  startY: rainBetween(-H, 0),
  len: rainBetween(14, 27),
  slant: rainBetween(-4, -1.5),
  duration: rainBetween(1.65, 2.4),
  delay: rainBetween(0, 1.8),
  opacity: rainBetween(0.22, 0.48),
}))

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const VINE_STROKE = 'hsl(172 33% 57%)'
const TRELLIS_STROKE = 'hsl(170 33% 74%)'
const RAIN_STROKE = 'hsl(176 35% 82%)'

export function GrowingTrellis({ className }: { className?: string }) {
  const id = useId()
  const [growthMs, setGrowthMs] = useState(0)
  const [raining, setRaining] = useState(false)
  const growthMsRef = useRef(0)
  const lastInteractionRef = useRef(0)
  const engagedMsRef = useRef(0)
  const rainingRef = useRef(false)
  const rainUntilRef = useRef(0)
  const nextRainAtRef = useRef(RAIN_FIRST_AFTER_MS)

  const subRM = useCallback((cb: () => void) => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  const snapRM = useCallback(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const serverRM = useCallback(() => false, [])
  const off = useSyncExternalStore(subRM, snapRM, serverRM)

  useEffect(() => {
    if (off) return

    let storedGrowth = 0
    try {
      const raw = window.localStorage.getItem(GROWTH_STORAGE_KEY)
      if (raw) storedGrowth = clamp(Number(raw) || 0, 0, GROWTH_TOTAL_MS)
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }

    growthMsRef.current = storedGrowth
    setGrowthMs(storedGrowth)
    setRaining(false)
    rainingRef.current = false
    engagedMsRef.current = 0
    nextRainAtRef.current = RAIN_FIRST_AFTER_MS

    let lastTick = performance.now()
    let lastPersist = lastTick
    lastInteractionRef.current = lastTick

    const persistGrowth = () => {
      try {
        window.localStorage.setItem(
          GROWTH_STORAGE_KEY,
          String(Math.round(growthMsRef.current)),
        )
      } catch {
        // The animation still works for this visit if persistence is blocked.
      }
    }

    const markInteraction = () => {
      lastInteractionRef.current = performance.now()
    }

    const handleVisibilityChange = () => {
      lastTick = performance.now()
      if (document.visibilityState === 'hidden') persistGrowth()
    }

    const tick = () => {
      const now = performance.now()
      const elapsed = Math.max(0, Math.min(now - lastTick, GROWTH_TICK_MS * 2.5))
      lastTick = now

      if (document.visibilityState !== 'visible') return

      if (growthMsRef.current < GROWTH_TOTAL_MS) {
        growthMsRef.current = Math.min(
          GROWTH_TOTAL_MS,
          growthMsRef.current + elapsed,
        )
        setGrowthMs(growthMsRef.current)
      }

      if (now - lastInteractionRef.current <= RAIN_ACTIVE_WINDOW_MS) {
        engagedMsRef.current += elapsed
      }

      if (rainingRef.current && now >= rainUntilRef.current) {
        rainingRef.current = false
        setRaining(false)
        nextRainAtRef.current =
          engagedMsRef.current + rainBetween(RAIN_GAP_MIN_MS, RAIN_GAP_MAX_MS)
      } else if (
        !rainingRef.current &&
        engagedMsRef.current >= nextRainAtRef.current
      ) {
        rainingRef.current = true
        rainUntilRef.current = now + RAIN_DURATION_MS
        setRaining(true)
      }

      if (now - lastPersist >= GROWTH_PERSIST_MS) {
        persistGrowth()
        lastPersist = now
      }
    }

    window.addEventListener('pointermove', markInteraction, { passive: true })
    window.addEventListener('pointerdown', markInteraction, { passive: true })
    window.addEventListener('keydown', markInteraction)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = window.setInterval(tick, GROWTH_TICK_MS)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pointermove', markInteraction)
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      persistGrowth()
    }
  }, [off])

  const progress = off ? 1 : growthProgress(growthMs)

  const grow = (delay: number, dur: number) =>
    off ? { duration: 0 } : { duration: dur, delay, ease: EASE }

  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <svg
        viewBox={'0 0 ' + W + ' ' + H}
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full"
      >
        {/* Lattice grid */}
        <g stroke={TRELLIS_STROKE} strokeOpacity="0.14" strokeWidth="1">
          {DR.map((c, i) => (
            <motion.line
              key={id + 'd' + i}
              x1={c}
              y1={0}
              x2={c + H}
              y2={H}
              pathLength={1}
              strokeDasharray="1"
              initial={{ strokeDashoffset: off ? 0 : 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={grow(i * 0.025, 1.1)}
            />
          ))}
          {UR.map((c, i) => (
            <motion.line
              key={id + 'u' + i}
              x1={c}
              y1={0}
              x2={c - H}
              y2={H}
              pathLength={1}
              strokeDasharray="1"
              initial={{ strokeDashoffset: off ? 0 : 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={grow(0.15 + i * 0.025, 1.1)}
            />
          ))}
        </g>

        {/* Fixed vine paths reveal slowly as visible auth-page time accumulates. */}
        {VINES.map((v) => {
          const vineProgress = off ? 1 : localVineProgress(v, progress)
          const tipProgress = off ? 1 : clamp((vineProgress - 0.965) / 0.035)

          return (
            <g key={v.id}>
              <motion.path
                d={v.d}
                fill="none"
                stroke={VINE_STROKE}
                strokeWidth={v.width}
                strokeLinecap="round"
                initial={false}
                animate={{ pathLength: vineProgress }}
                transition={off ? { duration: 0 } : { duration: 1.05, ease: 'linear' }}
              />

              <g
                transform={
                  'translate(' +
                  v.tip[0] +
                  ' ' +
                  v.tip[1] +
                  ') rotate(' +
                  v.tipAngle +
                  ') scale(1 ' +
                  (v.tipFlip ? -1 : 1) +
                  ')'
                }
              >
                <motion.path
                  d="M0 0 C 7.5 -0.5 12.5 -4 14 -8.5 C 15.5 -13.5 11.5 -16.5 7.5 -15 C 4 -13.8 3.5 -10 6.5 -8.8"
                  fill="none"
                  stroke={VINE_STROKE}
                  strokeWidth={v.width}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ pathLength: tipProgress, opacity: tipProgress }}
                  transition={off ? { duration: 0 } : { duration: 1.05, ease: 'linear' }}
                />
              </g>
            </g>
          )
        })}

        <AnimatePresence>
          {raining && !off && (
            <motion.g
              key="rain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8 }}
            >
              {RAIN_DROPS.map((drop) => (
                <motion.line
                  key={drop.id}
                  x1={drop.x}
                  x2={drop.x + drop.slant}
                  stroke={RAIN_STROKE}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity={drop.opacity}
                  initial={{
                    y1: drop.startY,
                    y2: drop.startY + drop.len,
                  }}
                  animate={{
                    y1: [drop.startY, H + 120],
                    y2: [drop.startY + drop.len, H + 120 + drop.len],
                  }}
                  transition={{
                    duration: drop.duration,
                    delay: drop.delay,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  )
}
