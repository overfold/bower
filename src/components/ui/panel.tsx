import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/card'

export const Panel = Card
export const PanelHeader = CardHeader

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
      <dd className={cn('mt-1 truncate text-sm text-ink', mono && 'font-mono text-sm')}>
        {children}
      </dd>
    </div>
  )
}
