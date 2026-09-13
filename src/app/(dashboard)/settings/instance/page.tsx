import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getInstanceAdmins, getInstanceOrganizations, isInstanceAdmin } from '@/lib/queries'
import { createOrganizationAction } from '@/lib/actions/settings'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function InstanceSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isInstanceAdmin(user.id))) redirect('/settings/organization')

  const [organizations, admins] = await Promise.all([
    getInstanceOrganizations(),
    getInstanceAdmins(),
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
                  <TableCell className="font-mono text-xs text-ink-muted">{org.slug}</TableCell>
                  <TableCell className="nums text-ink-muted">{memberCount}</TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-xs text-ink-muted">{org.trellisApiUrl}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <form action={createOrganizationAction}>
          <CardHeader>
            <div>
              <CardTitle>Create organization</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">Connect a new organization to its Trellis cluster</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instance-org-name">Name</Label>
                <Input id="instance-org-name" name="name" placeholder="Acme" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instance-org-slug">Slug</Label>
                <Input id="instance-org-slug" name="slug" placeholder="acme" className="font-mono" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-trellis-url">Trellis API URL</Label>
              <Input id="instance-trellis-url" name="trellisApiUrl" type="url" placeholder="https://trellis.example.com" className="font-mono" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-trellis-token">Trellis API token</Label>
              <Input id="instance-trellis-token" name="trellisApiToken" type="password" autoComplete="off" required />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="primary" size="sm">Create organization</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Instance administrators</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">Global administrators can access every organization without becoming organization owners</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Administrator</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium text-ink">{admin.name}</TableCell>
                  <TableCell className="text-ink-muted">{admin.email}</TableCell>
                  <TableCell><Badge variant="secondary">Instance</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
