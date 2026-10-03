'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Folder, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  const pathname = usePathname()
  return <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center"><span className="mb-3 rounded-xl bg-sunken p-3 text-ink-muted"><Folder className="size-5" /></span><h1 className="text-xl font-semibold text-ink">Page not found</h1><code className="mt-2 font-mono text-sm text-ink-soft">{pathname}</code><p className="mt-3 max-w-md text-sm text-ink-muted">This resource may have been removed, renamed, or may not be available in this organization.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button asChild variant="primary"><Link href="/projects">Go to projects</Link></Button><span className="inline-flex items-center gap-2 px-2 text-xs text-ink-muted"><Search className="size-3.5" />Search with ⌘K</span></div></div>
}
