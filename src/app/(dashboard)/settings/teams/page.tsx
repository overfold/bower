import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getTeamsByOrg, getTeamMembers, getTeamProjectAccessList } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamActions } from './team-actions'
import { Users } from 'lucide-react'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const teams = await getTeamsByOrg(orgCtx.org.id)
  const teamsWithDetails = await Promise.all(
    teams.map(async (team) => {
      const [members, access] = await Promise.all([
        getTeamMembers(team.id),
        getTeamProjectAccessList(team.id),
      ])
      return { team, members, access }
    }),
  )

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <PageHeading
        title="Teams"
        description="Manage teams and their project access."
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
          {teamsWithDetails.map(({ team, members, access }) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex min-w-0 items-center gap-2">
                  <CardTitle>{team.name}</CardTitle>
                  <Badge variant="secondary">{members.length} {members.length === 1 ? 'member' : 'members'}</Badge>
                </div>
                <TeamActions mode="delete" teamId={team.id} teamName={team.name} />
              </CardHeader>
              <CardContent className="grid gap-6 p-0 lg:grid-cols-2 lg:divide-x lg:divide-line">
                <section className="min-w-0">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="text-[13px] font-semibold tracking-tight text-ink">Members</h3>
                  </div>
                  {members.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[13px] text-ink-muted">No members assigned.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.membership.id}>
                            <TableCell className="font-medium text-ink">{member.userName}</TableCell>
                            <TableCell className="text-ink-muted">{member.userEmail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>

                <section className="min-w-0 lg:pl-0">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="text-[13px] font-semibold tracking-tight text-ink">Project access</h3>
                  </div>
                  {access.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[13px] text-ink-muted">No project access granted.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {access.map((entry) => (
                          <TableRow key={entry.access.id}>
                            <TableCell className="font-medium text-ink">{entry.projectName}</TableCell>
                            <TableCell><Badge variant="secondary">{entry.access.role}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
