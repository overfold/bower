'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { acceptInvitationAction } from '@/lib/actions/settings'
import { InlineNotice } from '@/components/ui/feedback'

export function AcceptInvitationCard({ token, status, organizationRole, grantInstanceAdmin }: {
  token: string
  status: 'active' | 'used' | 'expired' | 'revoked' | 'invalid'
  organizationRole: string | null
  grantInstanceAdmin: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const active = status === 'active'

  async function accept() {
    setPending(true)
    setError(null)
    try {
      const result = await acceptInvitationAction(token)
      if (result.error) setError(result.error)
      else {
        router.push('/projects')
        router.refresh()
      }
    } catch {
      setError('The invitation could not be accepted. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <h1 className="truncate text-[13px] font-semibold tracking-tight text-ink">{active ? 'Accept invitation' : 'Invitation unavailable'}</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          {active ? <p className="text-sm text-ink-muted">This invitation grants {organizationRole ? `${organizationRole} access to an organization` : 'access'}{grantInstanceAdmin ? `${organizationRole ? ' and' : ''} instance administrator access` : ''}.</p> : <p className="text-sm text-ink-muted">{status === 'used' ? 'This invitation has already been accepted.' : status === 'expired' ? 'This invitation has expired.' : status === 'revoked' ? 'This invitation has been revoked.' : 'This invitation is invalid.'}</p>}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          {active ? <Button variant="primary" onClick={accept} disabled={pending} aria-busy={pending}>{pending ? 'Accepting…' : 'Accept invitation'}</Button> : <Link href="/login" className="inline-flex font-medium text-brand-600 hover:underline">Return to Bower sign in</Link>}
        </CardContent>
      </Card>
    </main>
  )
}
