import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, deployments, services } from '@/db/schema'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { getProjectBySlug } from '@/lib/queries'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { StatusDot } from '@/components/status'

export default async function DeploymentDetailPage({ params }: { params: Promise<{ slug: string; deploymentId: string }> }) {
  const { slug, deploymentId } = await params
  const ctx = await requireContext()
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) notFound()
  await requireProject(project.id)
  const [row] = await db.select({ deployment: deployments, service: services })
    .from(deployments)
    .innerJoin(services, eq(services.id, deployments.serviceId))
    .where(and(eq(deployments.id, deploymentId), eq(services.projectId, project.id)))
    .limit(1)
  if (!row) notFound()
  const events = await db.select().from(deploymentEvents)
    .where(eq(deploymentEvents.deploymentId, deploymentId))
    .orderBy(deploymentEvents.createdAt)

  return <div className="space-y-5">
    <div><Link href={`/projects/${slug}/deployments`} className="text-sm text-ink-muted hover:text-ink">← Deployments</Link><SectionTitle>Deployment diagnostics</SectionTitle><div className="mt-2 flex items-center gap-3"><StatusDot status={row.deployment.status} /><span className="font-mono text-xs">{row.service.name} · {row.deployment.imageAfter}</span></div></div>
    <Panel><PanelHeader title="Events" />
      {events.length ? <ol className="divide-y divide-line">{events.map((event) => <li key={event.id} className="p-4"><p className="font-medium text-ink">{event.message}</p><p className="mt-1 text-xs text-ink-muted">{event.type} · {new Date(event.createdAt).toLocaleString()}</p>{Object.keys(event.details as object).length ? <pre className="mt-3 overflow-auto rounded bg-sunken p-3 text-xs text-ink-soft">{JSON.stringify(event.details, null, 2)}</pre> : null}</li>)}</ol> : <p className="p-4 text-sm text-ink-muted">No deployment events were recorded.</p>}
    </Panel>
  </div>
}
