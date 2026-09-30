'use client'

import { useRouter } from 'next/navigation'

export function TrellisReadError({ title, message }: { title: string; message: string }) {
  const router = useRouter()
  return (
    <div role="alert" className="p-4 text-[13px] text-ink-muted">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1">{message}</p>
      <button type="button" onClick={() => router.refresh()} className="mt-3 rounded text-xs font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">Retry</button>
    </div>
  )
}
