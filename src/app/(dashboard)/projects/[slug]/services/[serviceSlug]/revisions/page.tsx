import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService } from '@/lib/queries'
import { getProjectRole } from '@/lib/actions/shared'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { History } from 'lucide-react'
import { getTrellisClient } from '@/lib/trellis-instance'
import { RestoreRevisionButton } from './restore-revision-button'
import { earlierSuccessfulReleases, runningRelease } from '@/lib/service-releases'
import { RevisionsToolbar } from './revisions-toolbar'

export default async function RevisionsPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/no-organization')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const role = await getProjectRole(user.id, orgCtx.role, project.id)
  if (!role) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [environment, deployments, configs] = await Promise.all([
    getProjectEnvironment(project.id),
    getDeploymentsByService(service.id, null),
    getServiceConfigsWithEnvironments(service.id),
  ])
  if (!environment) notFound()
  const journal = deployments.filter((deployment) => deployment.environmentId === environment.id)
  const config = configs.find((entry) => entry.environment.id === environment.id)
  const jobName = config?.config.activeJobName || service.slug
  const client = await getTrellisClient(orgCtx.org.id)
  const runtime = config ? await client.getJob(jobName, environment.trellisNamespace).catch(() => null) : null
  const current = runningRelease(journal, runtime ? { name: jobName, incarnation: runtime.incarnation, version: runtime.version, revision: runtime.revision } : null)
  const rollbackIds = new Set(earlierSuccessfulReleases(journal, current).map((deployment) => deployment.id))

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Deployments</SectionTitle>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">Earlier successful releases with stored image pins can be restored.</p>
      </div>

      {journal.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<History className="h-4 w-4" />}
            title="No deployment history"
            body="Deploy this service to see its history here."
          />
        </Panel>
      ) : (
        <RevisionsToolbar items={journal.map((deployment) => ({ deployment, serviceName: service.name, serviceSlug: service.slug, projectName: project.name, projectSlug: project.slug, revision: deployment.trellisRevision, rollbackAction: role !== 'viewer' && rollbackIds.has(deployment.id) ? <RestoreRevisionButton serviceId={service.id} environmentId={environment.id} deploymentId={deployment.id} image={deployment.imageAfter} /> : null }))} />
      )}

    </div>
  )
}
