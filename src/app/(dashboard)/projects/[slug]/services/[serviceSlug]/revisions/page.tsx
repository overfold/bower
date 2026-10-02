import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService } from '@/lib/queries'
import { getProjectRole } from '@/lib/actions/shared'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History } from 'lucide-react'
import { DeploymentStatus } from '@/components/status'
import { Time } from '@/components/time'
import { getTrellisClient } from '@/lib/trellis-instance'
import { RestoreRevisionButton } from './restore-revision-button'

export default async function RevisionsPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const role = await getProjectRole(user.id, orgCtx.role, project.id)
  if (!role) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [environment, deployments, configs] = await Promise.all([
    getProjectEnvironment(project.id),
    getDeploymentsByService(service.id, 100),
    getServiceConfigsWithEnvironments(service.id),
  ])
  if (!environment) notFound()
  const journal = deployments.filter((deployment) => deployment.environmentId === environment.id)
  const config = configs.find((entry) => entry.environment.id === environment.id)
  const retained = config ? await getTrellisClient(orgCtx.org.id).then((client) => client.getJobVersions(config.config.activeJobName || service.slug, environment.trellisNamespace)).catch(() => []) : []
  const retainedKeys = new Set(retained.map((version) => `${version.version}:${version.revision}`))

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Deployment history</SectionTitle>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">Only the most recent configurations can be restored.</p>
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
        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>{deployment.trellisVersion ?? '—'}</TableCell>
                    <TableCell>{deployment.trellisRevision ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted">{deployment.trellisJobName ?? service.slug}</TableCell>
                    <TableCell><DeploymentStatus status={deployment.status} /></TableCell>
                    <TableCell className="text-right text-ink-muted">
                      <Time value={deployment.createdAt} />
                    </TableCell>
                    <TableCell className="text-right">{role !== 'viewer' && deployment.status === 'healthy' && deployment.jobSpec && retainedKeys.has(`${deployment.trellisVersion}:${deployment.trellisRevision}`) ? <RestoreRevisionButton serviceId={service.id} environmentId={environment.id} deploymentId={deployment.id} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

    </div>
  )
}
