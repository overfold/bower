import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ServiceHeader } from '../service-header'
import { History } from 'lucide-react'
import type { TrellisJobRevision } from '@/types/trellis'

export default async function RevisionsPage({ params, searchParams }: { params: Promise<{ slug: string; serviceSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const configs = await getServiceConfigsWithEnvironments(service.id)
  const { env } = await searchParams
  const environmentId = typeof env === 'string' ? env : null
  const activeConfig = environmentId ? configs.find((row) => row.environment.id === environmentId) : null
  if (environmentId && !activeConfig) notFound()

  let revisions: TrellisJobRevision[] = []
  if (activeConfig) {
    try {
      const client = await getTrellisClient(orgCtx.org.id)
      revisions = await client.getJobRevisions(activeConfig.config.activeJobName || service.slug, activeConfig.environment.trellisNamespace)
    } catch {
      // Trellis may be unreachable
    }
  }

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      {!activeConfig ? (
        <Panel>
          <EmptyState
            icon={<History className="h-4 w-4" />}
            title="Select an environment"
            body="Revision history belongs to a deployed Trellis job, not Base configuration."
          />
        </Panel>
      ) : revisions.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<History className="h-4 w-4" />}
            title="No revisions"
            body="No revisions have been recorded for the active deployment."
          />
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Revision</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisions.map((rev) => (
                  <TableRow key={rev.revision}>
                    <TableCell className="font-mono">{rev.revision}</TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted">{rev.spec.name}</TableCell>
                    <TableCell className="text-ink-muted">
                      {new Date(rev.created_at).toLocaleString()}
                    </TableCell>
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
