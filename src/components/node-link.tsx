import Link from 'next/link'
import { ResourceId } from '@/components/resource-id'

export function NodeLink({ id, name, className }: { id: string; name?: string | null; className?: string }) {
  if (!id) return <span className="text-ink-muted">—</span>
  return <Link href={`/status/${encodeURIComponent(id)}`} className="text-ink transition-colors hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"><ResourceId value={id} name={name} className={className} /></Link>
}

export { ResourceId }
