'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createContext, useContext } from 'react'
import { Button } from '@/components/ui/button'
import { PageBanner } from '@/components/ui/feedback'

const SharedTrellisError = createContext<string | null>(null)

export function TrellisReadErrorProvider({ message, children }: { message: string | null; children: React.ReactNode }) {
  const router = useRouter()
  return <SharedTrellisError.Provider value={message}>
    {message ? <PageBanner tone="warning" title="Trellis is unavailable.">{message}<span className="mt-2 flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => router.refresh()}>Retry connection</Button><Link href="/settings/organization#connection" className="font-medium underline">Check connection settings</Link></span></PageBanner> : null}
    {children}
  </SharedTrellisError.Provider>
}

export function TrellisReadError({ title, message }: { title: string; message: string }) {
  const router = useRouter()
  const sharedError = useContext(SharedTrellisError)
  return (
    <div role={message === sharedError ? 'status' : 'alert'} className="p-4 text-sm text-ink-muted">
      <p className="font-medium text-ink">{title}</p>
      {message !== sharedError ? <><p className="mt-1">{message}</p><Button variant="link" size="sm" onClick={() => router.refresh()} className="mt-2 px-0">Retry</Button></> : null}
    </div>
  )
}
