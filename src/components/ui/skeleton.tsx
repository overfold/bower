import * as React from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} role="status" className={cn('relative animate-pulse rounded bg-line motion-reduce:animate-none', className)}>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
