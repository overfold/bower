import * as React from 'react'
import { cn } from '@/lib/utils'
import { toneClasses, type Tone } from '@/lib/tone'

export function Chip({ tone = 'neutral', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-2xs font-medium tracking-normal', toneClasses[tone], className)} {...props} />
}
