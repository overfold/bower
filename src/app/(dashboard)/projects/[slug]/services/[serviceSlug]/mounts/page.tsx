import { notFound, redirect } from 'next/navigation'
import { HardDrive } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getMergedServiceConfig, getProjectBySlug, getProjectEnvironment, getProjectVolumes, getServiceBySlug, getUserOrganization } from '@/lib/queries'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { ServiceHeader } from '../service-header'
import { VolumeMountEditor } from './volume-mount-editor'

type Mount = { name: string; container_path: string; read_only?: boolean }

function mounts(value: unknown): Mount[] {
  return Array.isArray(value) ? value.filter((item): item is Mount => Boolean(item && typeof item === 'object' && 'name' in item && 'container_path' in item)) : []
}

export default async function ServiceMountsPage({ params }: {
  params: Promise<{ slug: string; serviceSlug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const org = await getUserOrganization(user.id)
  if (!org) redirect('/login')
  const { slug, serviceSlug } = await params
  const project = await getProjectBySlug(org.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()
  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const [config, available] = await Promise.all([
    getMergedServiceConfig(service.id, environment.id),
    getProjectVolumes(project.id, environment.id),
  ])
  const attached = mounts(config?.volumes)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />
      <div><SectionTitle>Volume mounts</SectionTitle><p className="mt-1 max-w-3xl text-[13px] text-ink-muted">Attach project volumes to this service and configure only the container mount path and access mode.</p></div>
      <Panel>
        <PanelHeader title="Mounts" hint={`${attached.length} attached`} action={config ? <VolumeMountEditor serviceId={service.id} environmentId={environment.id} mounts={attached} volumes={available.map((volume) => volume.name)} /> : undefined} />
        {!config ? (
          <EmptyState icon={<HardDrive className="h-4 w-4" />} title="No configuration" body="This service has no configuration in the selected scope." />
        ) : attached.length === 0 ? (
          <EmptyState icon={<HardDrive className="h-4 w-4" />} title="No volumes attached" body={available.length ? 'Attach a project volume to persist or share data.' : 'Define a project volume first.'} />
        ) : (
          <ul className="divide-y divide-line">{attached.map((mount) => <li key={mount.name} className="grid gap-2 px-4 py-3 text-[13px] sm:grid-cols-3"><span className="font-mono font-medium">{mount.name}</span><span className="font-mono text-xs text-ink-muted">{mount.container_path}</span><span className="text-ink-muted">{mount.read_only ? 'Read-only' : 'Read/write'}</span></li>)}</ul>
        )}
      </Panel>
    </div>
  )
}
