import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgMembers, getTeamMembershipsForOrg, getUserOrganization, isInstanceAdmin } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatTimestamp } from '@/lib/format'

export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')
  const { userId } = await params
  const members = await getOrgMembers(ctx.org.id)
  const member = members.find((row) => row.membership.userId === userId)
  if (!member) notFound()
  const [memberships, showInstanceRole] = await Promise.all([
    getTeamMembershipsForOrg(ctx.org.id),
    isInstanceAdmin(user.id),
  ])
  const teams = memberships.filter((row) => row.userId === userId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 rounded-lg">
          {member.userAvatar ? <AvatarImage src={member.userAvatar} alt={member.userName} /> : null}
          <AvatarFallback className="rounded-lg bg-brand-50 text-brand-700">
            {member.userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <PageHeading title={member.userName} description={`Member of ${ctx.org.name}`} />
      </div>
      <Panel>
        <PanelHeader title="Member details" />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="Email">{member.userEmail}</KeyValue>
          {showInstanceRole ? <KeyValue label="Instance role">{member.isInstanceAdmin ? 'Instance admin' : 'User'}</KeyValue> : null}
          <KeyValue label="Organization role">{({ owner: 'Owner', admin: 'Admin', member: 'Member' } as const)[member.membership.role]}</KeyValue>
          <KeyValue label="Joined organization">{formatTimestamp(member.membership.createdAt)}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Teams" hint={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`} />
        {teams.length ? (
          <ul className="divide-y divide-line">
            {teams.map((team) => <li key={team.teamId} className="px-4 py-3 text-sm text-ink">{team.teamName}</li>)}
          </ul>
        ) : <p className="p-4 text-sm text-ink-muted">This member does not belong to any teams.</p>}
      </Panel>
    </div>
  )
}
