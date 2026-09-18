import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getProjectVolumes, getUserOrganization } from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { SectionTitle } from '@/components/ui/panel'
import { VolumeManager } from './volume-manager'

export default async function ProjectVolumesPage({ params }: {
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
  const volumes = await getProjectVolumes(project.id, environment.id)

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Volumes</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Define persistent storage that can be attached by multiple services. Managed local storage remains pinned to its Trellis node.
        </p>
      </div>
      <VolumeManager projectId={project.id} environmentId={environment.id} volumes={volumes} canManage={access.projectRole === 'admin'} />
    </div>
  )
}
