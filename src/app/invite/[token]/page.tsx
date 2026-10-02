import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getInvitationByToken, invitationStatus } from '@/lib/invitations'
import { AcceptInvitationCard } from './accept-invitation-card'
import { AuthLayout } from '@/components/auth-layout'

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)
  const status = invitation ? invitationStatus(invitation) : 'invalid'
  const currentUser = await getCurrentUser()
  const path = `/invite/${token}`

  if (!currentUser) {
    redirect(`/login?next=${encodeURIComponent(path)}`)
  }

  return <AuthLayout><AcceptInvitationCard token={token} status={status} organizationRole={invitation?.organizationRole ?? null} grantInstanceAdmin={invitation?.grantInstanceAdmin ?? false} organizationName={invitation?.organizationName ?? null} inviterName={invitation?.inviterName ?? null} account={{ name: currentUser.name, email: currentUser.email }} expiresAt={invitation?.expiresAt?.toISOString() ?? null} /></AuthLayout>
}
