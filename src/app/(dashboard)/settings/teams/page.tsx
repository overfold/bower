import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getUserOrganization, getTeamsByOrg, getTeamMembers, getTeamProjectAccessList } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamActions, TeamRowActions } from './team-actions'
import { ChevronRight, Users } from 'lucide-react'
import { ClickableTableRow } from '@/components/clickable-table-row'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const cookieStore = await cookies()
  const preferredOrgId = cookieStore.get(ORG_COOKIE_NAME)?.value ?? null
  const orgCtx = await getUserOrganization(user.id, preferredOrgId)
  if (!orgCtx) redirect('/login')

  const teams = await getTeamsByOrg(orgCtx.org.id)

  const teamsWithDetails = await Promise.all(
    teams.map(async (team) => {
      const [members, projectAccess] = await Promise.all([getTeamMembers(team.id), getTeamProjectAccessList(team.id)])
      return { team, members, projectAccess }
    }),
  )

  return (
    <div className="space-y-6">
      <PageHeading
        as="h2"
        title="Teams"
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
          <CardHeader title={`${teamsWithDetails.length} ${teamsWithDetails.length === 1 ? 'team' : 'teams'}`} action={<TeamActions mode="create" />} />
          <Table>
            <TableHeader><TableRow><TableHead>Team</TableHead><TableHead>Members</TableHead><TableHead>Projects</TableHead><TableHead className="w-[120px] text-right"><span className="sr-only">Actions</span></TableHead><TableHead className="w-12"><span className="sr-only">View</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {teamsWithDetails.map(({ team, members, projectAccess }) => (
                <ClickableTableRow key={team.id} href={`/settings/teams/${team.id}`} label={`View team ${team.name}`}>
                  <TableCell className="font-medium"><Link className="text-link" href={`/settings/teams/${team.id}`}>{team.name}</Link></TableCell>
                  <TableCell className="nums text-ink-muted">{members.length}</TableCell>
                  <TableCell className="nums text-ink-muted">{projectAccess.length}</TableCell>
                  <TableCell><TeamRowActions teamId={team.id} teamName={team.name} /></TableCell>
                  <TableCell><ChevronRight className="ml-auto h-4 w-4 text-ink-muted" aria-hidden="true" /></TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
