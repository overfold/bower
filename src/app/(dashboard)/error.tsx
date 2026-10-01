'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/feedback'

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold text-ink">Page unavailable</h1>
    <InlineNotice tone="error">Bower could not load this page. Try again, or return to the overview.</InlineNotice>
    <div className="flex flex-wrap gap-2"><Button onClick={retry}>Try again</Button><Button asChild><Link href="/dashboard">Back to overview</Link></Button></div>
  </div>
}
