import Link from 'next/link'
import { cn } from '@/lib/utils'

export function NodeLink({ id, className }: { id: string; className?: string }) {
  if (!id) return <span className="text-ink-muted">—</span>
  return (
    <Link href={`/status/${encodeURIComponent(id)}`} title={id} className={cn('font-mono text-xs font-medium text-ink transition-colors hover:text-brand-500', className)}>
      {id.slice(0, 8)}
    </Link>
  )
}
