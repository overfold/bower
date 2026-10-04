import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { HardDrive, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getMergedServiceConfig, getProjectBySlug, getProjectEnvironment, getProjectVolumes, getServiceBySlug, getUserOrganization } from '@/lib/queries'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { VolumeMountActions, VolumeMountEditor } from './volume-mount-editor'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  if (!org) redirect('/no-organization')
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
      <div><SectionTitle>Mounts</SectionTitle><p className="mt-1 max-w-3xl text-sm text-ink-muted">Attach project volumes to this service.</p></div>
      <Panel>
        <PanelHeader title="Mounts" hint={`${attached.length} attached`} action={config ? <VolumeMountEditor serviceId={service.id} environmentId={environment.id} mounts={attached} volumes={available.map((volume) => volume.name)} /> : undefined} />
        {!config ? (
          <EmptyState icon={<HardDrive className="h-4 w-4" />} title="No configuration" body="This service has no configuration in the selected scope." />
        ) : attached.length === 0 ? (
          <EmptyState
            icon={<HardDrive className="h-4 w-4" />}
            title="No volumes attached"
            body={available.length ? 'Attach a project volume to persist or share data.' : 'Define a project volume before attaching it to this service.'}
            action={available.length
              ? <VolumeMountEditor serviceId={service.id} environmentId={environment.id} mounts={attached} volumes={available.map((volume) => volume.name)} />
              : <Button asChild variant="primary" size="sm"><Link href={`/projects/${slug}/settings#volumes`}><Plus />Add volume</Link></Button>}
          />
        ) : (
          <Table><TableHeader><TableRow><TableHead>Volume</TableHead><TableHead>Mount path</TableHead><TableHead>Access</TableHead><TableHead className="w-14"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{attached.map((mount) => <TableRow key={mount.name}><TableCell className="font-mono font-medium">{mount.name}</TableCell><TableCell className="font-mono text-xs text-ink-muted">{mount.container_path}</TableCell><TableCell className="text-ink-muted">{mount.read_only ? 'Read-only' : 'Read/write'}</TableCell><TableCell><VolumeMountActions serviceId={service.id} environmentId={environment.id} mount={mount} mounts={attached} /></TableCell></TableRow>)}</TableBody></Table>
        )}
      </Panel>
    </div>
  )
}
