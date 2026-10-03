import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getInstanceOrganizations, isInstanceAdmin } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateOrganizationDialog } from './create-organization-form'
import { ConfigureOrganizationLink } from './configure-organization-link'
import { OrganizationRowLink } from './organization-row-link'

export default async function InstanceSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isInstanceAdmin(user.id))) redirect('/settings/organization')

  const organizations = await getInstanceOrganizations()

  return (
    <div className="space-y-6">
      <PageHeading
        as="h2"
        title="Organizations"
      />

      <Card>
        <CardHeader title={`${organizations.length} ${organizations.length === 1 ? 'organization' : 'organizations'}`} action={<CreateOrganizationDialog />} />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Trellis API</TableHead>
                <TableHead className="w-12"><span className="sr-only">Switch</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map(({ org, memberCount }) => (
                <TableRow key={org.id} interactive className="group relative">
                  <TableCell className="font-medium text-link">{org.name}</TableCell>
                  <TableCell className="text-ink-muted">{memberCount}</TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-sm text-ink-muted">
                    {org.trellisApiUrl || <span className="flex items-center gap-2 font-sans"><span>Not configured</span><ConfigureOrganizationLink organizationId={org.id} /></span>}
                  </TableCell>
                  <TableCell><OrganizationRowLink organizationId={org.id} organizationName={org.name} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
