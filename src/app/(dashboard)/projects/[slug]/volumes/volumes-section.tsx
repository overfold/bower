import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getProjectVolumes, getServicesByProject, getServiceConfigs, getUserOrganization } from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { SectionTitle } from '@/components/ui/panel'
import { VolumeManager } from './volume-manager'
import { instanceAdminMayBypassMultitenancy } from '@/lib/workload-policy'

export default async function ProjectVolumesSection({ params }: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const org = await getUserOrganization(user.id)
  if (!org) redirect('/login')
  const { slug } = await params
  const project = await getProjectBySlug(org.org.id, slug)
  if (!project) notFound()
  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const access = await requireProject(project.id)
  const [volumes, services] = await Promise.all([getProjectVolumes(project.id, environment.id), getServicesByProject(project.id)])
  const configRows = await Promise.all(services.map(async (service) => ({ service, configs: await getServiceConfigs(service.id) })))
  const usages = configRows.flatMap(({ service, configs }) => {
    const config = configs.find((item) => item.environmentId === environment.id)
    const mounts = Array.isArray(config?.volumes) ? config.volumes as { name?: string; container_path?: string }[] : []
    return mounts.filter((mount) => mount.name).map((mount) => ({ volumeName: mount.name!, serviceName: service.name, serviceSlug: service.slug, mountPath: mount.container_path ?? 'Unknown path' }))
  })

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Volumes</SectionTitle>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">
          Define persistent storage that can be attached by multiple services. Managed local storage remains pinned to its Trellis node.
        </p>
      </div>
      <VolumeManager
        projectId={project.id}
        environmentId={environment.id}
        volumes={volumes}
        usages={usages}
        projectSlug={slug}
        canManage={access.projectRole === 'admin'}
        allowAbsoluteHostPaths={instanceAdminMayBypassMultitenancy(user.isInstanceAdmin)}
      />
    </div>
  )
}
