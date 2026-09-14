import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getOrgMembers, getOrganizationTokens, getTeamMembershipsForOrg, getTeamsByOrg, getInstanceTokens, isInstanceAdmin } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { InviteTokensSection } from '@/components/invite-tokens-section'
import { AddMemberDialog } from './add-member-dialog'
import { MembersTable } from './members-table'
import { AddInstanceAdminDialog, RemoveInstanceAdminButton } from '../instance/instance-admin-actions'
import { InstanceTokensSection } from '../instance/instance-tokens-section'

export default async function MembersSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const showInstanceAdmin = await isInstanceAdmin(user.id)

  const [members, tokens, teamMemberships, teams, instanceTokens] = await Promise.all([
    getOrgMembers(orgCtx.org.id),
    getOrganizationTokens(orgCtx.org.id),
    getTeamMembershipsForOrg(orgCtx.org.id),
    getTeamsByOrg(orgCtx.org.id),
    showInstanceAdmin ? getInstanceTokens() : Promise.resolve([]),
  ])
  const canManageRoles = orgCtx.role === 'owner'

  const teamsByUser = new Map<string, string[]>()
  for (const tm of teamMemberships) {
    const existing = teamsByUser.get(tm.userId) ?? []
    existing.push(tm.teamName)
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

  const teamNames = teams.map((t) => t.name)

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <PageHeading
        title="Members"
        description="Manage who belongs to this organization and invite new members."
        actions={
          <div className="flex items-center gap-2">
            {showInstanceAdmin && <AddInstanceAdminDialog />}
            <AddMemberDialog canManage={canManageRoles} />
          </div>
        }
      />

      <MembersTable
        members={serializedMembers}
        teamNames={teamNames}
        canManageRoles={canManageRoles}
        showInstanceAdmin={showInstanceAdmin}
        currentUserId={user.id}
      />

      <InviteTokensSection
        tokens={tokens.map((row) => ({
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
        }))}
        role={orgCtx.role}
      />

      {showInstanceAdmin && (
        <InstanceTokensSection tokens={instanceTokens as any} />
      )}
    </div>
  )
}
