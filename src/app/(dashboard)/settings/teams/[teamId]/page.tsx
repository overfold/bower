import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getOrgMembers, getTeamMembers, getTeamProjectAccessList, getTeamsByOrg, getUserOrganization } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddTeamMemberDialog, RemoveTeamMemberButton, TeamRowActions } from '../team-actions'

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { teamId } = await params
  const preferredOrgId = (await cookies()).get(ORG_COOKIE_NAME)?.value ?? null
  const orgCtx = await getUserOrganization(user.id, preferredOrgId)
  if (!orgCtx) redirect('/login')
  const team = (await getTeamsByOrg(orgCtx.org.id)).find((item) => item.id === teamId)
  if (!team) notFound()
  const [members, access, orgMembers] = await Promise.all([
    getTeamMembers(teamId), getTeamProjectAccessList(teamId), getOrgMembers(orgCtx.org.id),
  ])
  const canManage = orgCtx.role === 'owner' || orgCtx.role === 'admin'
  return <div className="space-y-6">
    <PageHeading as="h2" title={team.name} description={`${members.length} ${members.length === 1 ? 'member' : 'members'} · ${access.length} ${access.length === 1 ? 'project' : 'projects'}`} actions={canManage ? <div className="flex gap-2"><TeamRowActions teamId={teamId} teamName={team.name} renameButton /><AddTeamMemberDialog teamId={teamId} orgMembers={orgMembers.map((m) => ({ userId: m.membership.userId, name: m.userName, email: m.userEmail }))} existingMemberIds={members.map((m) => m.membership.userId)} /></div> : undefined} />
    <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead>{canManage ? <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead> : null}</TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.membership.id}><TableCell>{member.userName}</TableCell><TableCell className="text-ink-muted">{member.userEmail}</TableCell>{canManage ? <TableCell><RemoveTeamMemberButton teamId={teamId} membershipId={member.membership.id} memberName={member.userName} /></TableCell> : null}</TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle>Project access</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Role</TableHead></TableRow></TableHeader><TableBody>{access.map((item) => <TableRow key={item.access.id}><TableCell><Link className="text-link" href={`/projects/${item.projectSlug}`}>{item.projectName}</Link></TableCell><TableCell className="capitalize">{item.access.role}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    {canManage ? <Card className="border-danger-200"><CardHeader><CardTitle>Danger zone</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-ink">Delete this team</p><p className="text-xs text-ink-muted">Deleting revokes all project access assigned through this team.</p></div><TeamRowActions teamId={teamId} teamName={team.name} deleteButton /></CardContent></Card> : null}
  </div>
}
