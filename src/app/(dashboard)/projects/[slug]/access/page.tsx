import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectAccess, getTeamsByOrg, getOrgMembers } from '@/lib/queries'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Shield, UserRound, Users } from 'lucide-react'
import { GrantAccessDialog, RevokeAccessButton } from './access-actions'

export default async function AccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const { slug } = await params
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) redirect('/projects')

  const { teamGrants, userGrants } = await getProjectAccess(project.id)
  const isAdmin = orgCtx.role === 'owner' || orgCtx.role === 'admin'
  const hasGrants = teamGrants.length > 0 || userGrants.length > 0

  const [allTeams, allMembers] = await Promise.all([
    getTeamsByOrg(orgCtx.org.id),
    getOrgMembers(orgCtx.org.id),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <SectionTitle>Project access</SectionTitle>
          <p className="mt-1 text-[13px] text-ink-muted">
            Control who can view, deploy to, or administer this project. Organization owners and admins always have full access.
          </p>
        </div>
        {isAdmin && (
          <GrantAccessDialog
            projectId={project.id}
            teams={allTeams.map(t => ({ id: t.id, name: t.name }))}
            members={allMembers.map(m => ({ id: m.membership.id, userId: m.membership.userId, name: m.userName, email: m.userEmail }))}
            existingTeamIds={teamGrants.map(g => g.access.teamId)}
            existingUserIds={userGrants.map(g => g.access.userId)}
          />
        )}
      </div>

      {!hasGrants ? (
        <Panel>
          <EmptyState
            icon={<Shield className="h-4 w-4" />}
            title="No project access"
            body="Grant a team or individual access to this project."
          />
        </Panel>
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team or member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Granted</TableHead>
                {isAdmin && <TableHead className="w-[56px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamGrants.map(({ access, teamName }) => (
                <TableRow key={`team-${access.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span className="font-medium text-ink">{teamName}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{access.role}</Badge></TableCell>
                  <TableCell className="text-xs text-ink-muted">{new Date(access.createdAt).toLocaleDateString()}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <RevokeAccessButton projectId={project.id} accessId={access.id} kind="team" name={teamName} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {userGrants.map(({ access, userName, userEmail }) => (
                <TableRow key={`user-${access.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserRound className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{userName}</div>
                        <div className="truncate text-xs text-ink-muted">{userEmail}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{access.role}</Badge></TableCell>
                  <TableCell className="text-xs text-ink-muted">{new Date(access.createdAt).toLocaleDateString()}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <RevokeAccessButton projectId={project.id} accessId={access.id} kind="user" name={userName} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  )
}
