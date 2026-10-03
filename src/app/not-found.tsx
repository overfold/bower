import Link from 'next/link'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center text-ink">
    <Brand />
    <div className="space-y-2"><h1 className="text-xl font-semibold">Page not found</h1><p className="max-w-md text-sm text-ink-muted">This page may have moved or no longer exists. Check the address or return to your workspace.</p></div>
    <Button asChild variant="primary"><Link href="/dashboard">Go to Home</Link></Button>
  </main>
}
