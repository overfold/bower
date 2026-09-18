'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { acceptInvitationAction } from '@/lib/actions/settings'

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
    const result = await acceptInvitationAction(token)
    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      router.push('/projects')
      router.refresh()
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{active ? 'Accept invitation' : 'Invitation unavailable'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {active ? <p className="text-sm text-ink-muted">This invitation grants {organizationRole ? `${organizationRole} access to an organization` : 'access'}{grantInstanceAdmin ? `${organizationRole ? ' and' : ''} instance administrator access` : ''}.</p> : <p className="text-sm text-ink-muted">{status === 'used' ? 'This invitation has already been accepted.' : status === 'expired' ? 'This invitation has expired.' : status === 'revoked' ? 'This invitation has been revoked.' : 'This invitation is invalid.'}</p>}
          {error ? <p role="alert" className="text-sm text-danger-500">{error}</p> : null}
          {active ? <Button variant="primary" onClick={accept} disabled={pending}>{pending ? 'Accepting…' : 'Accept invitation'}</Button> : null}
        </CardContent>
      </Card>
    </main>
  )
}
