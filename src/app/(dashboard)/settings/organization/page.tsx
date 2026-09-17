import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { OrgSettingsForm } from '@/components/org-settings-form'

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  return (
    <div className="space-y-6">
      <PageHeading
        title="Organization"
        description="Manage the identity and organization-wide configuration for the currently selected organization."
      />

      <OrgSettingsForm
        org={{ id: orgCtx.org.id, name: orgCtx.org.name, slug: orgCtx.org.slug }}
      />
    </div>
  )
}
