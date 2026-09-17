import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { ClusterSettingsForm } from '@/components/cluster-settings-form'

export default async function ClusterSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  return (
    <div className="space-y-6">
      <PageHeading title="Cluster" description="Configure the connection to your Trellis cluster." />

      <ClusterSettingsForm
        org={{
          trellisApiUrl: orgCtx.org.trellisApiUrl,
          trellisApiToken: orgCtx.org.trellisApiToken,
        }}
      />
    </div>
  )
}
