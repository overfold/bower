import { notFound, redirect } from 'next/navigation'
import { HardDrive, Box } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getServiceBySlug, getEnvironmentsByProject, getMergedServiceConfig, getUserOrganization } from '@/lib/queries'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip } from '@/components/status'
import { ServiceHeader } from '../service-header'
import { VolumeEditor } from './volume-editor'
import type { TrellisVolume } from '@/types/trellis'

function normalizeVolumes(value: unknown): TrellisVolume[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : ''
    const containerPath = typeof row.container_path === 'string' ? row.container_path : typeof row.path === 'string' ? row.path : ''
    let hostPath = typeof row.host_path === 'string' ? row.host_path : ''
    if (!hostPath && typeof row.host_volume === 'string' && row.host_volume) {
      const legacy = row.host_volume
      hostPath = legacy.startsWith('/') || legacy.startsWith('@/') ? legacy : `@/${legacy}`
    }
    if (!hostPath && name) hostPath = `@/${name}`
    return name && containerPath ? [{ name, host_path: hostPath, container_path: containerPath, read_only: row.read_only === true }] : []
  })
}

export default async function VolumesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, serviceSlug } = await params
  const { env: envParam } = await searchParams
  const environmentId = typeof envParam === 'string' ? envParam : null

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const environments = await getEnvironmentsByProject(project.id)
  const selectedEnv = environmentId ? environments.find((e) => e.id === environmentId) ?? null : null
  const mergedConfig = await getMergedServiceConfig(service.id, environmentId)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-2">
        <SectionTitle>Volumes</SectionTitle>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Volumes are configured per environment. Managed local storage stays on its owning node, while host paths use an existing absolute directory on that node. Neither type is replicated, migrated, snapshotted, or backed up automatically.
        </p>
      </div>

      <div className="space-y-4">
        {!mergedConfig ? (
          <Panel>
            {environmentId ? (
              <EmptyState
                icon={<Box className="h-4 w-4" />}
                title="Environment not configured"
                body="No configuration found for this environment."
              />
            ) : (
              <EmptyState
                icon={<Box className="h-4 w-4" />}
                title="No base configuration"
                body="Set a base configuration on the Overview tab first."
              />
            )}
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title={selectedEnv ? selectedEnv.name : 'Base configuration'}
              hint={(() => {
                const volumes = normalizeVolumes(mergedConfig.volumes)
                return `${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}`
              })()}
              action={
                <VolumeEditor
                  serviceId={service.id}
                  environmentId={environmentId}
                  volumes={mergedConfig.volumes}
                  isBase={!environmentId}
                />
              }
            />
            {(() => {
              const volumes = normalizeVolumes(mergedConfig.volumes)
              return volumes.length === 0 ? (
                <EmptyState
                  icon={<HardDrive className="h-4 w-4" />}
                  title="No volumes"
                  body={selectedEnv ? "This service is stateless in this environment." : "No volumes defined in base configuration."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Storage</TableHead>
                        <TableHead>Backing path</TableHead>
                        <TableHead>Mount path</TableHead>
                        <TableHead>Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {volumes.map((volume) => (
                        <TableRow key={volume.name}>
                          <TableCell className="font-mono text-xs font-medium">{volume.name}</TableCell>
                          <TableCell>
                            <Chip tone={volume.host_path.startsWith('@/') ? 'neutral' : 'warn'}>
                              {volume.host_path.startsWith('@/') ? 'Managed local' : 'Host path'}
                            </Chip>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-ink-muted">{volume.host_path}</TableCell>
                          <TableCell className="font-mono text-xs text-ink-muted">{volume.container_path}</TableCell>
                          <TableCell className="text-ink-muted">{volume.read_only ? 'Read-only' : 'Read/write'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            })()}
          </Panel>
        )}
      </div>
    </div>
  )
}
