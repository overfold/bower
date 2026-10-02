import Link from 'next/link'
import { FolderSearch, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return <EmptyState icon={<FolderSearch className="size-4" />} title="Page not found" body="This resource may have been removed, renamed, or may not be available in this organization." action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="primary"><Link href="/projects">Go to projects</Link></Button><span className="inline-flex items-center gap-2 px-2 text-xs text-ink-muted"><Search className="size-3.5" />Search with ⌘K</span></div>} />
}
