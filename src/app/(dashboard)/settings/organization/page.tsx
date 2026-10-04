import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { OrgSettingsForm } from '@/components/org-settings-form'
import { ClusterSettingsForm } from '@/components/cluster-settings-form'

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/no-organization')

  return (
    <div className="space-y-6">
      <PageHeading
        as="h2"
        title="Organization"
      />

      <section id="details" className="scroll-mt-20"><OrgSettingsForm
        org={{ id: orgCtx.org.id, name: orgCtx.org.name, slug: orgCtx.org.slug }}
      /></section>
      {orgCtx.role !== 'member' && <section id="connection" className="scroll-mt-20"><ClusterSettingsForm org={{ trellisApiUrl: orgCtx.org.trellisApiUrl, tokenConfigured: Boolean(orgCtx.org.trellisApiToken), workloadIdentity: orgCtx.org.useTrellisWorkloadIdentity }} /></section>}
    </div>
  )
}
