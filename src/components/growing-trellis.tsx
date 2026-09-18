'use client'

import { useCallback, useId, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const W = 800
const H = 1000
const LATTICE_PITCH = 70
const SAMPLE_STEP = 26
const GROWTH_RATE = 0.006

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
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
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
    id: `v${idx}`,
    d: catmullRom(pts),
    len: len * 1.04,
    width: between(2.1, 2.7),
    delay,
    dur: climb * GROWTH_RATE,
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

const RAIL_N = Math.ceil((W + H) / LATTICE_PITCH)
const DR = Array.from({ length: RAIL_N }, (_, i) => (i - Math.ceil(H / LATTICE_PITCH)) * LATTICE_PITCH)
const UR = Array.from({ length: RAIL_N }, (_, i) => i * LATTICE_PITCH)

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const VINE_STROKE = 'hsl(172 33% 57%)'
const TRELLIS_STROKE = 'hsl(170 33% 74%)'

export function GrowingTrellis({ className }: { className?: string }) {
  const id = useId()

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

  const grow = (delay: number, dur: number) =>
    off
      ? { duration: 0 }
      : { duration: dur, delay, ease: EASE }

  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        {/* Lattice grid */}
        <g stroke={TRELLIS_STROKE} strokeOpacity="0.14" strokeWidth="1">
          {DR.map((c, i) => (
            <motion.line
              key={`${id}d${i}`}
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
              key={`${id}u${i}`}
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

        {/* Vines grow into place, then remain still. */}
        {VINES.map((v) => (
          <g key={v.id}>
            <motion.path
              d={v.d}
              fill="none"
              stroke={VINE_STROKE}
              strokeWidth={v.width}
              strokeLinecap="round"
              initial={{ pathLength: off ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={grow(v.delay, v.dur)}
            />

            <g transform={`translate(${v.tip[0]} ${v.tip[1]}) rotate(${v.tipAngle}) scale(1 ${v.tipFlip ? -1 : 1})`}>
              <motion.path
                d="M0 0 C 7.5 -0.5 12.5 -4 14 -8.5 C 15.5 -13.5 11.5 -16.5 7.5 -15 C 4 -13.8 3.5 -10 6.5 -8.8"
                fill="none"
                stroke={VINE_STROKE}
                strokeWidth={v.width}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
                initial={off ? { strokeDashoffset: 0, opacity: 1 } : { strokeDashoffset: 1, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 1 }}
                transition={off ? { duration: 0 } : { duration: 1.2, delay: v.delay + v.dur, ease: 'linear' }}
              />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
