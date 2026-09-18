import { notFound, redirect } from 'next/navigation'
import { HardDrive } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getEnvironmentsByProject, getProjectBySlug, getProjectVolumes, getUserOrganization } from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { VolumeManager } from './volume-manager'

export default async function ProjectVolumesPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const org = await getUserOrganization(user.id)
  if (!org) redirect('/login')
  const { slug } = await params
  const project = await getProjectBySlug(org.org.id, slug)
  if (!project) notFound()
  const environments = await getEnvironmentsByProject(project.id)
  const { env } = await searchParams
  const environmentId = typeof env === 'string' ? env : null
  const environment = environmentId ? environments.find((item) => item.id === environmentId) : null
  if (environmentId && !environment) notFound()
  const access = await requireProject(project.id)
  const volumes = environment ? await getProjectVolumes(project.id, environment.id) : []

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Volumes</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Volumes belong to the selected environment namespace and can be attached by multiple services. Managed local storage remains pinned to its Trellis node.
        </p>
      </div>
      {!environment ? (
        <Panel>
          <EmptyState icon={<HardDrive className="h-4 w-4" />} title="Select an environment" body="Choose an environment to view and manage its volumes." />
        </Panel>
      ) : (
        <VolumeManager projectId={project.id} environmentId={environment.id} environmentName={environment.name} volumes={volumes} canManage={access.projectRole === 'admin'} />
      )}
    </div>
  )
}
