import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getInstanceAdmins, getInstanceOrganizations, getInstanceTokens, isInstanceAdmin } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CreateOrganizationForm } from './create-organization-form'
import { AddInstanceAdminDialog, RemoveInstanceAdminButton } from './instance-admin-actions'
import { InstanceTokensSection } from './instance-tokens-section'

export default async function InstanceSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isInstanceAdmin(user.id))) redirect('/settings/organization')

  const [organizations, admins, tokens] = await Promise.all([
    getInstanceOrganizations(),
    getInstanceAdmins(),
    getInstanceTokens(),
  ])

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <PageHeading
        title="Instance"
        description="Manage this Bower installation. Instance administration is separate from membership or ownership inside an organization."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organizations</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">Organizations hosted by this Bower instance</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Trellis API</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map(({ org, memberCount }) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-ink">{org.name}</TableCell>
                  <TableCell className="font-mono text-[12.5px] text-ink-muted">{org.slug}</TableCell>
                  <TableCell className="nums text-ink-muted">{memberCount}</TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-[12.5px] text-ink-muted">{org.trellisApiUrl}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateOrganizationForm />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Instance administrators</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">Global administrators can access every organization without becoming organization owners</p>
          </div>
          <AddInstanceAdminDialog />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Administrator</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium text-ink">{admin.name}</TableCell>
                  <TableCell className="text-ink-muted">{admin.email}</TableCell>
                  <TableCell><Badge variant="secondary">Instance</Badge></TableCell>
                  <TableCell>
                    <RemoveInstanceAdminButton email={admin.email} adminId={admin.id} currentUserId={user.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InstanceTokensSection tokens={tokens as any} />
    </div>
  )
}
