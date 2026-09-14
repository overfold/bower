import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectAccess, getTeamsByOrg, getOrgMembers } from '@/lib/queries'
import { Panel } from '@/components/ui/panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionTitle } from '@/components/ui/panel'
import { Shield, Users } from 'lucide-react'
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

      {/* Team access section */}
      <div className="space-y-5">
        <SectionTitle>Teams</SectionTitle>
        {teamGrants.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Users className="h-4 w-4" />}
              title="No team access"
              body="Grant a team access to let its members work on this project."
            />
          </Panel>
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Granted</TableHead>
                  {isAdmin && <TableHead className="w-[56px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamGrants.map(({ access, teamName }) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-medium text-ink">{teamName}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{access.role}</Badge></TableCell>
                    <TableCell className="text-xs text-ink-muted">{new Date(access.createdAt).toLocaleDateString()}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <RevokeAccessButton projectId={project.id} accessId={access.id} kind="team" name={teamName} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </div>

      {/* Individual access section */}
      <div className="space-y-5">
        <SectionTitle>Individuals</SectionTitle>
        {userGrants.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Shield className="h-4 w-4" />}
              title="No individual access"
              body="Grant individual users access when they need project permissions outside of a team."
            />
          </Panel>
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Granted</TableHead>
                  {isAdmin && <TableHead className="w-[56px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {userGrants.map(({ access, userName, userEmail }) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-medium text-ink">{userName}</TableCell>
                    <TableCell className="text-ink-muted">{userEmail}</TableCell>
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
    </div>
  )
}
