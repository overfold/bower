import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { getProjectRole } from '@/lib/actions/shared'
import { trellisReadError } from '@/lib/trellis-runtime'
import { TrellisReadError } from '@/components/trellis-read-error'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ServiceHeader } from '../service-header'
import { History } from 'lucide-react'
import type { TrellisJobVersion } from '@/types/trellis'
import { StatusDot } from '@/components/status'
import { formatTimestamp } from '@/lib/format'

export default async function RevisionsPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  if (!await getProjectRole(user.id, orgCtx.role, project.id)) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [configs, environment, deployments] = await Promise.all([
    getServiceConfigsWithEnvironments(service.id),
    getProjectEnvironment(project.id),
    getDeploymentsByService(service.id, 100),
  ])
  if (!environment) notFound()
  const activeConfig = configs.find((row) => row.environment.id === environment.id)
  const journal = deployments.filter((deployment) => deployment.environmentId === environment.id)

  let versions: TrellisJobVersion[] = []
  let historyError: string | null = null
  if (activeConfig) {
    try {
      const client = await getTrellisClient(orgCtx.org.id)
      versions = await client.getJobVersions(activeConfig.config.activeJobName || service.slug, activeConfig.environment.trellisNamespace)
    } catch (error) {
      historyError = trellisReadError(error)
    }
  }

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} serviceId={service.id} environmentId={environment.id} hasConfig={Boolean(activeConfig)} />

      <div>
        <SectionTitle>Deployment history</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">Bower’s deployment journal is the durable history. Trellis retains only the 10 newest versions of the current live job and removes that history when the job is deleted.</p>
      </div>

      {journal.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<History className="h-4 w-4" />}
            title="No deployment history"
            body="Deploy this service to create a durable Bower journal entry."
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
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell className="font-mono">{deployment.trellisVersion ?? '—'}</TableCell>
                    <TableCell className="font-mono">{deployment.trellisRevision ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted">{deployment.trellisJobName ?? service.slug}</TableCell>
                    <TableCell><StatusDot status={deployment.status} /></TableCell>
                    <TableCell className="text-ink-muted">
                      {formatTimestamp(deployment.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      <div>
        <SectionTitle>Retained Trellis versions</SectionTitle>
        <p className="mt-1 text-[13px] text-ink-muted">Version advances for every accepted spec change; revision advances only when execution content changes.</p>
      </div>
      {!activeConfig ? <Panel><EmptyState icon={<History className="h-4 w-4" />} title="No service configuration" body="Configure this service before viewing live Trellis history." /></Panel>
        : historyError ? <Panel><TrellisReadError title="Trellis history unavailable" message={historyError} /></Panel>
          : versions.length === 0 ? <Panel><EmptyState icon={<History className="h-4 w-4" />} title="No retained versions" body="The current Trellis job has no retained version history." /></Panel>
            : <Panel><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Revision</TableHead><TableHead>Job</TableHead><TableHead>Created</TableHead></TableRow></TableHeader><TableBody>
              {versions.map((entry) => <TableRow key={`${entry.version}-${entry.revision}`}><TableCell className="font-mono">{entry.version}</TableCell><TableCell className="font-mono">{entry.revision}</TableCell><TableCell className="font-mono text-xs text-ink-muted">{entry.spec.name}</TableCell><TableCell className="text-ink-muted">{formatTimestamp(entry.created_at)}</TableCell></TableRow>)}
            </TableBody></Table></div></Panel>}
    </div>
  )
}
