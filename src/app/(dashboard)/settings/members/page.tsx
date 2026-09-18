import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getOrgMembers,
  getOrganizationTokens,
  getTeamMembershipsForOrg,
  getTeamsByOrg,
  getInstanceTokens,
  isInstanceAdmin,
} from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { InviteTokensSection } from '@/components/invite-tokens-section'
import { AddMemberDialog } from './add-member-dialog'
import { MembersTable } from './members-table'
import { AddInstanceAdminDialog } from '../instance/instance-admin-actions'

export default async function MembersSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const showInstanceAdmin = await isInstanceAdmin(user.id)
  const canManageRoles = showInstanceAdmin || orgCtx.role === 'owner'

  const [tokens, instanceTokens] = await Promise.all([
    getOrganizationTokens(orgCtx.org.id),
    showInstanceAdmin ? getInstanceTokens() : Promise.resolve([]),
  ])

  const [members, teamMemberships, teams] = await Promise.all([
    getOrgMembers(orgCtx.org.id),
    getTeamMembershipsForOrg(orgCtx.org.id),
    getTeamsByOrg(orgCtx.org.id),
  ])

  const teamsByUser = new Map<string, Array<{ id: string; name: string }>>()
  for (const tm of teamMemberships) {
    const existing = teamsByUser.get(tm.userId) ?? []
    existing.push({ id: tm.teamId, name: tm.teamName })
    teamsByUser.set(tm.userId, existing)
  }

  const serializedMembers = members.map((member) => ({
    membershipId: member.membership.id,
    userId: member.membership.userId,
    name: member.userName,
    email: member.userEmail,
    avatar: member.userAvatar,
    role: member.membership.role as 'owner' | 'admin' | 'member',
    isInstanceAdmin: member.isInstanceAdmin,
    teams: teamsByUser.get(member.membership.userId) ?? [],
  }))

  const teamOptions = teams.map((team) => ({ id: team.id, name: team.name }))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Members"
        description={`Manage members, teams, and invitations for ${orgCtx.org.name}.`}
        actions={
          <div className="flex items-center gap-2">
            {showInstanceAdmin && <AddInstanceAdminDialog />}
            <AddMemberDialog canManage={canManageRoles} />
          </div>
        }
      />

      <MembersTable
        members={serializedMembers}
        teams={teamOptions}
        canManageRoles={canManageRoles}
        showInstanceAdmin={showInstanceAdmin}
        currentUserId={user.id}
      />

      <InviteTokensSection
        tokens={[
          ...tokens.map((row) => ({
            kind: 'organization' as const,
            token: {
              id: row.token.id,
              tokenPrefix: row.token.tokenPrefix,
              role: row.token.role,
              note: row.token.note,
              usedAt: row.token.usedAt?.toISOString() ?? null,
              expiresAt: row.token.expiresAt?.toISOString() ?? null,
              createdAt: row.token.createdAt.toISOString(),
            },
            createdByName: row.createdByName,
          })),
          ...instanceTokens.map((row) => ({
            kind: 'instance' as const,
            token: {
              id: row.token.id,
              tokenPrefix: row.token.tokenPrefix,
              role: null,
              note: row.token.note,
              usedAt: row.token.usedAt?.toISOString() ?? null,
              expiresAt: row.token.expiresAt?.toISOString() ?? null,
              createdAt: row.token.createdAt.toISOString(),
            },
            createdByName: row.createdByName,
          })),
        ].sort((a, b) => new Date(b.token.createdAt).getTime() - new Date(a.token.createdAt).getTime())}
        role={orgCtx.role}
        showInstanceAdmin={showInstanceAdmin}
      />
    </div>
  )
}
