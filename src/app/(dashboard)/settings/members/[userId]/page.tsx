import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgMembers, getTeamMembershipsForOrg, getUserOrganization, isInstanceAdmin } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Time } from '@/components/time'
import { MemberRoleSelect } from '../member-role-select'
import { MemberActionsMenu } from '../../instance/instance-admin-actions'

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
  const canManageRoles = showInstanceRole || ctx.role === 'owner'
  const canRemove = ctx.role === 'owner' && user.id !== userId

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 rounded-lg">
          {member.userAvatar ? <AvatarImage src={member.userAvatar} alt={member.userName} /> : null}
          <AvatarFallback className="rounded-lg bg-brand-50 text-brand-700">
            {member.userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <PageHeading as="h2" title={member.userName} description={`Member of ${ctx.org.name}`} />
      </div>
      <Panel>
        <PanelHeader title="Member details" />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="Email">{member.userEmail}</KeyValue>
          <KeyValue label="Instance role">{member.isInstanceAdmin ? 'Admin' : 'User'}</KeyValue>
          <KeyValue label="Joined"><Time value={member.membership.createdAt} mode="absolute" /></KeyValue>
        </dl>
      </Panel>
      {canManageRoles ? <Panel>
        <PanelHeader title="Organization role" />
        <div className="flex flex-wrap items-end justify-between gap-4 p-4">
          <div className="space-y-2"><p className="text-xs font-medium text-ink-muted">Organization role</p>{member.membership.role === 'owner' ? <p className="text-sm text-ink">Owner</p> : <MemberRoleSelect membershipId={member.membership.id} role={member.membership.role} canManage={canManageRoles} />}</div>
        </div>
      </Panel> : null}
      <Panel>
        <PanelHeader title="Teams" hint={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`} />
        {teams.length ? (
          <ul className="divide-y divide-line">
            {teams.map((team) => <li key={team.teamId} className="px-4 py-3 text-sm text-ink">{team.teamName}</li>)}
          </ul>
        ) : <p className="p-4 text-sm text-ink-muted">This member does not belong to any teams.</p>}
      </Panel>
      {(canRemove || (showInstanceRole && member.isInstanceAdmin && user.id !== userId)) ? <Panel>
        <PanelHeader title="Danger zone" />
        <div className="flex items-center justify-between gap-4 p-4"><p className="text-sm text-ink-muted">Remove elevated or organization access for this member.</p><MemberActionsMenu presentation="buttons" membershipId={member.membership.id} memberName={member.userName} email={member.userEmail} canRemoveInstanceAdmin={showInstanceRole && member.isInstanceAdmin && user.id !== userId} canRemoveFromOrganization={canRemove} /></div>
      </Panel> : null}
    </div>
  )
}
