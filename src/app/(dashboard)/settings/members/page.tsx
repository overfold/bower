import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getOrgMembers,
  getOrganizationTokens,
  getTeamMembershipsForOrg,
  getTeamsByOrg,
  getInstanceTokens,
  getInstanceMembers,
  getInstanceTeamMemberships,
  getInstanceTeams,
  getInstanceOrganizations,
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

  let serializedMembers: Array<{
    membershipId: string | null
    userId: string
    name: string
    email: string
    avatar: string | null
    role: 'owner' | 'admin' | 'member' | null
    isInstanceAdmin: boolean
    organizationId: string | null
    organizationName: string | null
    teams: Array<{ id: string; name: string }>
  }> = []
  let teamOptions: Array<{
    id: string
    name: string
    organizationId: string
    organizationName: string
  }> = []
  let organizationOptions: Array<{ id: string; name: string }> = []

  if (showInstanceAdmin) {
    const [members, teamMemberships, teams, organizations] = await Promise.all([
      getInstanceMembers(),
      getInstanceTeamMemberships(),
      getInstanceTeams(),
      getInstanceOrganizations(),
    ])

    const teamsByMembership = new Map<string, Array<{ id: string; name: string }>>()
    for (const tm of teamMemberships) {
      const key = `${tm.userId}:${tm.organizationId}`
      const existing = teamsByMembership.get(key) ?? []
      existing.push({ id: tm.teamId, name: tm.teamName })
      teamsByMembership.set(key, existing)
    }

    serializedMembers = members.map((member) => ({
      membershipId: member.membership?.id ?? null,
      userId: member.userId,
      name: member.userName,
      email: member.userEmail,
      avatar: member.userAvatar,
      role: (member.membership?.role as 'owner' | 'admin' | 'member' | undefined) ?? null,
      isInstanceAdmin: member.isInstanceAdmin,
      organizationId: member.organizationId,
      organizationName: member.organizationName,
      teams: member.organizationId
        ? teamsByMembership.get(`${member.userId}:${member.organizationId}`) ?? []
        : [],
    }))

    teamOptions = teams.map((team) => ({
      id: team.id,
      name: team.name,
      organizationId: team.organizationId,
      organizationName: team.organizationName,
    }))
    organizationOptions = organizations.map(({ org }) => ({ id: org.id, name: org.name }))
  } else {
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

    serializedMembers = members.map((member) => ({
      membershipId: member.membership.id,
      userId: member.membership.userId,
      name: member.userName,
      email: member.userEmail,
      avatar: member.userAvatar,
      role: member.membership.role as 'owner' | 'admin' | 'member',
      isInstanceAdmin: member.isInstanceAdmin,
      organizationId: orgCtx.org.id,
      organizationName: orgCtx.org.name,
      teams: teamsByUser.get(member.membership.userId) ?? [],
    }))

    teamOptions = teams.map((team) => ({
      id: team.id,
      name: team.name,
      organizationId: orgCtx.org.id,
      organizationName: orgCtx.org.name,
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Members"
        description={
          showInstanceAdmin
            ? 'Manage users, organization memberships, and invitations across this Bower instance.'
            : 'Manage who belongs to this organization and invite new members.'
        }
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
        organizations={organizationOptions}
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
