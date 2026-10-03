import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'

export const Panel = Card
export const PanelHeader = CardHeader

export function PanelFooter({ shown, total, href, children, always = false }: { shown: number; total: number; href: string; children: React.ReactNode; always?: boolean }) {
  if (!always && shown >= total) return null
  return <CardFooter className="justify-between text-xs text-ink-muted"><span>Showing {shown} of {total}</span><Link href={href} className="text-link font-medium">{children} →</Link></CardFooter>
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-lg font-semibold tracking-tight text-ink', className)}>
      {children}
    </h2>
  )
}

export function KeyValue({ label, children, mono }: { label: React.ReactNode; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 py-2.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn('mt-1 truncate text-sm text-ink', mono && 'font-mono text-sm')}>
        {children}
      </dd>
    </div>
  )
}
