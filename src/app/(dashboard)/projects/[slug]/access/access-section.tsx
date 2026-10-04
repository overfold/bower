import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectAccess, getTeamsByOrg, getOrgMembers, getTeamMembershipsForOrg } from '@/lib/queries'
import Link from 'next/link'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { ChevronRight, Shield, UserRound, Users } from 'lucide-react'
import { GrantAccessDialog, RevokeAccessButton } from './access-actions'
import { Time } from '@/components/time'
import { roleLabels } from '@/lib/labels'
import { ClickableTableRow } from '@/components/clickable-table-row'

export default async function AccessSection({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/no-organization')
  const { slug } = await params
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) redirect('/projects')

  const { teamGrants, userGrants } = await getProjectAccess(project.id)
  const isAdmin = orgCtx.role === 'owner' || orgCtx.role === 'admin'
  const [allTeams, allMembers, memberships] = await Promise.all([
    getTeamsByOrg(orgCtx.org.id),
    getOrgMembers(orgCtx.org.id),
    getTeamMembershipsForOrg(orgCtx.org.id),
  ])
  const rank = { viewer: 0, deployer: 1, admin: 2 } as const
  const effectiveMembers = allMembers.flatMap((member) => {
    if (member.membership.role === 'owner' || member.membership.role === 'admin') return [{ member, role: 'admin' as const, source: member.membership.role === 'owner' ? 'Org owner' : 'Org admin' }]
    const direct = userGrants.find(({ access }) => access.userId === member.membership.userId)
    const teamSources = memberships.filter((membership) => membership.userId === member.membership.userId).flatMap((membership) => {
      const grant = teamGrants.find(({ access }) => access.teamId === membership.teamId)
      return grant ? [{ name: membership.teamName, role: grant.access.role }] : []
    })
    const grants = [...teamSources.map((source) => source.role), ...(direct ? [direct.access.role] : [])]
    if (!grants.length) return []
    const role = grants.reduce((best, current) => rank[current] > rank[best] ? current : best)
    const source = direct && direct.access.role === role ? 'Direct' : `via ${teamSources.find((team) => team.role === role)?.name}`
    return [{ member, role, source }]
  })
  const hasGrants = teamGrants.length > 0 || effectiveMembers.length > 0
  const entityCount = teamGrants.length + effectiveMembers.length
  const grantAction = isAdmin ? (
    <GrantAccessDialog
      projectId={project.id}
      teams={allTeams.map(t => ({ id: t.id, name: t.name }))}
      members={allMembers.map(m => ({ id: m.membership.id, userId: m.membership.userId, name: m.userName, email: m.userEmail }))}
      existingTeamIds={teamGrants.map(g => g.access.teamId)}
      existingUserIds={effectiveMembers.map(({ member }) => member.membership.userId)}
    />
  ) : undefined

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionTitle>Project access</SectionTitle>
          <p className="mt-1 text-sm text-ink-muted">
            Each person receives the combined permissions granted by their organization role, team memberships, and individual project access.
          </p>
        </div>
      </div>

      {!hasGrants ? (
        <Panel>
          <PanelHeader title="0 with access" action={grantAction} />
          <EmptyState
            icon={<Shield className="h-4 w-4" />}
            title="No project access"
            body="Grant a team or individual access to this project."
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title={`${entityCount} with access`} action={grantAction} />
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Time</TableHead>
                {isAdmin && <TableHead className="w-[56px]"><span className="sr-only">Actions</span></TableHead>}
                <TableHead className="w-12"><span className="sr-only">View</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamGrants.map(({ access, teamName }) => (
                <ClickableTableRow key={`team-${access.id}`} href={`/settings/teams/${access.teamId}`} label={`View team ${teamName}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <Link href={`/settings/teams/${access.teamId}`} className="font-medium text-link">{teamName}</Link>
                    </div>
                  </TableCell>
                  <TableCell>{roleLabels[access.role]}</TableCell>
                  <TableCell>Direct team</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs text-ink-muted"><Time value={access.createdAt} /></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <RevokeAccessButton projectId={project.id} accessId={access.id} kind="team" name={teamName} />
                    </TableCell>
                  )}
                  <TableCell><ChevronRight className="ml-auto h-4 w-4 text-ink-muted" aria-hidden="true" /></TableCell>
                </ClickableTableRow>
              ))}
              {effectiveMembers.map(({ member, role, source }) => {
                const direct = userGrants.find(({ access }) => access.userId === member.membership.userId)
                return <ClickableTableRow key={`user-${member.membership.userId}`} href={`/settings/members/${member.membership.userId}`} label={`View member ${member.userName}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserRound className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <Link href={`/settings/members/${member.membership.userId}`} className="font-medium text-link">{member.userName}</Link>
                        <div className="truncate text-xs text-ink-muted">{member.userEmail}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{roleLabels[role]}</TableCell>
                  <TableCell>{source}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs text-ink-muted">{direct ? <Time value={direct.access.createdAt} /> : '—'}</TableCell>
                  {isAdmin && direct ? (
                    <TableCell className="text-right">
                      <RevokeAccessButton projectId={project.id} accessId={direct.access.id} kind="user" name={member.userName} email={member.userEmail} />
                    </TableCell>
                  ) : isAdmin ? <TableCell /> : null}
                  <TableCell><ChevronRight className="ml-auto h-4 w-4 text-ink-muted" aria-hidden="true" /></TableCell>
                </ClickableTableRow>
              })}
            </TableBody>
          </Table>
          </div>
        </Panel>
      )}
    </div>
  )
}
