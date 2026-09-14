import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getTeamsByOrg, getTeamMembers, getOrgMembers } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TeamActions, AddTeamMemberDialog, RemoveTeamMemberButton } from './team-actions'
import { Users, ChevronRight } from 'lucide-react'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
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
      const members = await getTeamMembers(team.id)
      return { team, members }
    }),
  )

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
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
        <div className="space-y-4">
          {teamsWithDetails.map(({ team, members }) => (
            <Card key={team.id}>
              <Collapsible>
                <CardHeader>
                  <CollapsibleTrigger className="flex min-w-0 items-center gap-2">
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                    <CardTitle>{team.name}</CardTitle>
                    <Badge variant="secondary">{members.length} {members.length === 1 ? 'member' : 'members'}</Badge>
                  </CollapsibleTrigger>
                  <TeamActions mode="delete" teamId={team.id} teamName={team.name} />
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <h3 className="text-[13px] font-semibold tracking-tight text-ink">Members</h3>
                      <AddTeamMemberDialog
                        teamId={team.id}
                        orgMembers={orgMemberList}
                        existingMemberIds={members.map((m) => m.membership.userId)}
                      />
                    </div>
                    {members.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[13px] text-ink-muted">No members assigned.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="w-[56px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member) => (
                            <TableRow key={member.membership.id}>
                              <TableCell className="font-medium text-ink">{member.userName}</TableCell>
                              <TableCell className="text-ink-muted">{member.userEmail}</TableCell>
                              <TableCell>
                                <RemoveTeamMemberButton
                                  teamId={team.id}
                                  membershipId={member.membership.id}
                                  memberName={member.userName}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
