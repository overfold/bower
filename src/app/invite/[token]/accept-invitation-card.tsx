'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { acceptInvitationAction } from '@/lib/actions/settings'
import { InlineNotice } from '@/components/ui/feedback'
import { logoutAction } from '@/lib/auth-actions'
import { Time } from '@/components/time'

export function AcceptInvitationCard({ token, status, organizationRole, grantInstanceAdmin, organizationName, inviterName, account, expiresAt }: {
  token: string
  status: 'active' | 'used' | 'expired' | 'revoked' | 'invalid'
  organizationRole: string | null
  grantInstanceAdmin: boolean
  organizationName: string | null
  inviterName: string | null
  account: { name: string; email: string }
  expiresAt: string | null
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

  function decline() {
    router.push('/dashboard')
  }

  const unavailableMessage = status === 'used'
    ? 'This invitation has already been used.'
    : status === 'expired'
      ? <>This invitation expired{expiresAt ? <> on <Time value={expiresAt} mode="absolute" /></> : null}.</>
      : status === 'revoked'
        ? 'This invitation was revoked by an administrator.'
        : 'This invitation link is invalid or no longer exists.'

  return (
    <div className="space-y-5">
          <div><h1 className="text-lg font-semibold tracking-tight text-ink">{active ? `Join ${organizationName ?? 'organization'}` : 'Invitation unavailable'}</h1>
          {active ? <p className="mt-1 text-sm text-ink-muted">{inviterName ? `${inviterName} invited you` : 'You were invited'} to join {organizationName ?? 'the organization'} as {organizationRole ? `${organizationRole === 'admin' ? 'an' : 'a'} ${organizationRole}` : grantInstanceAdmin ? 'an instance administrator' : 'a member'}.{expiresAt ? <> Expires <Time value={expiresAt} mode="absolute" />.</> : null}</p> : <p className="mt-1 text-sm text-ink-muted">{unavailableMessage}</p>}</div>
          {active ? <div className="rounded-lg bg-sunken p-3 text-sm"><p className="font-medium text-ink">{account.name}</p><p className="text-xs text-ink-muted">{account.email}</p><form action={logoutAction}><input type="hidden" name="next" value={`/invite/${token}`} /><button type="submit" className="mt-2 text-link">Not you? Switch account</button></form></div> : null}
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          {active ? <div className="space-y-2"><Button className="w-full" variant="primary" size="md" onClick={accept} disabled={pending} aria-busy={pending}>{pending ? 'Accepting…' : 'Accept invitation'}</Button><Button className="w-full" variant="ghost" onClick={decline} disabled={pending}>Decline</Button></div> : <Button asChild className="w-full" variant="primary"><Link href="/login">Sign in</Link></Button>}
    </div>
  )
}
