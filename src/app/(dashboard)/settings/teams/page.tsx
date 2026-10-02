import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getUserOrganization, getTeamsByOrg, getTeamMembers, getTeamProjectAccessList } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamActions, TeamRowActions } from './team-actions'
import { Users } from 'lucide-react'

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
            <TableHeader><TableRow><TableHead>Team</TableHead><TableHead>Members</TableHead><TableHead>Projects</TableHead><TableHead className="w-[120px] text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {teamsWithDetails.map(({ team, members, projectAccess }) => (
                <TableRow key={team.id} interactive>
                  <TableCell className="font-medium"><Link className="block text-ink hover:text-brand-700" href={`/settings/teams/${team.id}`}>{team.name}</Link></TableCell>
                  <TableCell className="nums text-ink-muted"><Link className="block" href={`/settings/teams/${team.id}`} aria-label={`${members.length} members in ${team.name}`}>{members.length}</Link></TableCell>
                  <TableCell className="nums text-ink-muted"><Link className="block" href={`/settings/teams/${team.id}`} aria-label={`${projectAccess.length} projects for ${team.name}`}>{projectAccess.length}</Link></TableCell>
                  <TableCell><TeamRowActions teamId={team.id} teamName={team.name} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
