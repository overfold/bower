import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ServiceHeader } from '../service-header'
import type { TrellisJobRevision } from '@/types/trellis'

export default async function RevisionsPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const targets = await getServiceConfigsWithEnvironments(service.id)
  const activeTarget = targets.find((row) => row.deployment.activeJobName)

  let revisions: TrellisJobRevision[] = []
  if (activeTarget) {
    try {
      const client = await getTrellisClient(orgCtx.org.id)
      revisions = await client.getJobRevisions(activeTarget.deployment.activeJobName!)
    } catch {
      // Trellis may be unreachable
    }
  }

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      {!activeTarget ? (
        <Card>
          <CardContent className="py-8 text-center text-ink-muted">
            No active Trellis job for this service.
          </CardContent>
        </Card>
      ) : revisions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-ink-muted">
            No revisions found.
          </CardContent>
        </Card>
      ) : (
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
                  <TableCell className="text-ink-muted">{new Date(rev.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
