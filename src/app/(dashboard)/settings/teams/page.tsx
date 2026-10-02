import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getUserOrganization, getTeamsByOrg, getTeamMembers, getOrgMembers, getTeamProjectAccessList } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamActions, AddTeamMemberDialog, RemoveTeamMemberButton } from './team-actions'
import { Users } from 'lucide-react'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const cookieStore = await cookies()
  const preferredOrgId = cookieStore.get(ORG_COOKIE_NAME)?.value ?? null
  const orgCtx = await getUserOrganization(user.id, preferredOrgId)
  if (!orgCtx) redirect('/login')

  const [teams, orgMembers] = await Promise.all([
    getTeamsByOrg(orgCtx.org.id),
    getOrgMembers(orgCtx.org.id),
  ])

  const orgMemberList = orgMembers.map((m) => ({
    userId: m.membership.userId,
    name: m.userName,
    email: m.userEmail,
  }))

  const teamsWithDetails = await Promise.all(
    teams.map(async (team) => {
      const [members, projectAccess] = await Promise.all([getTeamMembers(team.id), getTeamProjectAccessList(team.id)])
      return { team, members, projectAccess }
    }),
  )

  return (
    <div className="space-y-6">
      <PageHeading
        title="Teams"
        description="Manage teams and their members."
        actions={<TeamActions mode="create" />}
      />

      {teamsWithDetails.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No teams yet"
            body="Create a team to group members and control project access."
            action={<TeamActions mode="create" />}
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>Team</TableHead><TableHead>Members</TableHead><TableHead>Project access</TableHead><TableHead className="w-[120px] text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {teamsWithDetails.map(({ team, members, projectAccess }) => (
                <TableRow key={team.id} className="align-top">
                  <TableCell className="font-medium text-ink">{team.name}</TableCell>
                  <TableCell>
                    <div className="min-w-[260px] space-y-2">
                      <div className="flex justify-between gap-3 text-xs text-ink-muted"><span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                      <AddTeamMemberDialog
                        teamId={team.id}
                        orgMembers={orgMemberList}
                        existingMemberIds={members.map((m) => m.membership.userId)}
                      />
                    </div>
                    {members.length === 0 ? (
                      <span className="text-sm text-ink-muted">No members assigned</span>
                    ) : (
                      <ul className="divide-y divide-line">{members.map((member) => <li key={member.membership.id} className="flex items-center justify-between gap-3 py-1.5"><span><span className="text-sm text-ink">{member.userName}</span><span className="ml-2 text-xs text-ink-muted">{member.userEmail}</span></span><RemoveTeamMemberButton teamId={team.id} membershipId={member.membership.id} memberName={member.userName} /></li>)}</ul>
                    )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-ink-soft">{projectAccess.length ? projectAccess.map((access) => access.projectName).join(', ') : 'No project access'}</TableCell>
                  <TableCell><div className="flex justify-end gap-1"><TeamActions mode="edit" teamId={team.id} teamName={team.name} /><TeamActions mode="delete" teamId={team.id} teamName={team.name} /></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
