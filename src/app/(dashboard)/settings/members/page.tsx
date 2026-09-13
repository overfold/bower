import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getOrgMembers, getOrganizationTokens } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { InviteTokensSection } from '@/components/invite-tokens-section'
import { MemberRoleSelect } from './member-role-select'

export default async function MembersSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const [members, tokens] = await Promise.all([
    getOrgMembers(orgCtx.org.id),
    getOrganizationTokens(orgCtx.org.id),
  ])
  const canManageRoles = orgCtx.role === 'owner'

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <PageHeading
        title="Members"
        description="Manage who belongs to this organization and invite new members. Team membership and project access are managed separately under Teams."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization members</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization role</TableHead>
                {canManageRoles ? <TableHead className="w-[136px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.membership.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 rounded-md">
                        {member.userAvatar ? <AvatarImage src={member.userAvatar} /> : null}
                        <AvatarFallback className="rounded-md bg-ink text-2xs font-semibold text-white">
                          {member.userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px] font-medium text-ink">{member.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-muted">{member.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant={member.membership.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                      {member.membership.role}
                    </Badge>
                  </TableCell>
                  {canManageRoles ? (
                    <TableCell>
                      <MemberRoleSelect
                        membershipId={member.membership.id}
                        role={member.membership.role}
                        canManage={canManageRoles}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InviteTokensSection
        tokens={tokens.map((row) => ({
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
        }))}
        role={orgCtx.role}
      />
    </div>
  )
}
