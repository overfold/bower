import Link from 'next/link'
import { ResourceId } from '@/components/resource-id'

export function NodeLink({ id, name, className }: { id: string; name?: string | null; className?: string }) {
  if (!id) return <span className="text-ink-muted">—</span>
  return <Link href={`/status/${encodeURIComponent(id)}`} className="relative z-10 text-link transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ResourceId value={id} name={name} className={className} /></Link>
}

export { ResourceId }
