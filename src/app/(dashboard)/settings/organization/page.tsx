import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrgSettingsForm } from '@/components/org-settings-form'

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      <PageHeading
        title="Organization"
        description="Manage the identity and organization-wide configuration for the currently selected organization."
      />

      <OrgSettingsForm
        org={{ id: orgCtx.org.id, name: orgCtx.org.name, slug: orgCtx.org.slug }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Organization identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-muted">Slug</p>
            <p className="mt-1 font-mono text-[12.5px] text-ink">{orgCtx.org.slug}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Your role</p>
            <div className="mt-1"><Badge variant="secondary" className="capitalize">{orgCtx.role}</Badge></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
