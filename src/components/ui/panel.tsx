import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/card'

export const Panel = Card

interface PanelHeaderProps {
  title: string
  hint?: string
  action?: React.ReactNode
  className?: string
  as?: 'h2' | 'h3'
}

export function PanelHeader({ title, hint, action, className, as: Heading = 'h2' }: PanelHeaderProps) {
  return (
    <CardHeader className={cn('flex-col items-stretch sm:flex-row sm:items-center', className)}>
      <div className="min-w-0 flex-1">
        <Heading className="break-words text-md font-semibold tracking-tight text-ink">
          {title}
        </Heading>
        {hint ? <p className="mt-0.5 break-words text-xs text-ink-muted">{hint}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{action}</div> : null}
    </CardHeader>
  )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-lg font-semibold tracking-tight text-ink', className)}>
      {children}
    </h2>
  )
}

export function KeyValue({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 py-2.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn("mt-1 truncate text-sm text-ink", mono && "font-mono text-sm")}>
        {children}
      </dd>
    </div>
  )
}
