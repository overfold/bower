import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getDeploymentsForOrg } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { DeploymentFilters } from './deployment-filters'

export default async function DeploymentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const allDeployments = await getDeploymentsForOrg(orgCtx.org.id, 100)

  const items = allDeployments.map((d) => ({
    deployment: {
      id: d.deployment.id,
      status: d.deployment.status,
      triggerType: d.deployment.triggerType,
      imageAfter: d.deployment.imageAfter,
      imageBefore: d.deployment.imageBefore,
      createdAt: d.deployment.createdAt,
      startedAt: d.deployment.startedAt,
      completedAt: d.deployment.completedAt,
    },
    serviceName: d.serviceName,
    serviceSlug: d.serviceSlug,
    environmentName: d.environmentName,
    projectName: d.projectName,
    projectSlug: d.projectSlug,
    userName: d.userName,
  }))

  const projectNames = [...new Set(items.map((d) => d.projectName))].sort()
  const envNames = [...new Set(items.map((d) => d.environmentName))].sort()

  return (
    <div className="space-y-6">
      <PageHeading
        title="Deployments"
        description="Every deployment across the organization."
      />

      <DeploymentFilters
        items={items}
        projects={projectNames}
        environments={envNames}
      />
    </div>
  )
}
