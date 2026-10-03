import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectEnvironment,
  getServicesByProject,
} from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { PageHeading } from '@/components/page-heading'
import { ProjectTabs } from '@/components/project-tabs'
import { ProjectShell } from './project-shell'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { Chip } from '@/components/ui/badge'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')

  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) notFound()
  await requireProject(project.id)

  const [services, environment] = await Promise.all([
    getServicesByProject(project.id),
    getProjectEnvironment(project.id),
  ])
  const live = await getProjectLiveServices(ctx.org.id, project.id, environment)
  const failing = live.services.filter(({ health }) => health !== 'healthy').length

  const tabs = [
    { label: 'Overview', href: '' },
    { label: 'Services', href: '/services', count: services.length },
    { label: 'Deployments', href: '/deployments' },
    { label: 'Routes', href: '/routes' },
    { label: 'Environment', href: '/environment' },
    { label: 'Settings', href: '/settings' },
  ]

  const header = <>
      <PageHeading
        title={<span className="flex flex-wrap items-center gap-3">{project.name}{services.length > 0 ? <Chip tone={failing ? 'danger' : 'success'}>{failing ? `${failing} of ${services.length} failing` : 'Healthy'}</Chip> : null}</span>}
        description={project.description ?? undefined}
      />
      <div className="mt-6 border-b border-line">
        <ProjectTabs slug={slug} tabs={tabs} />
      </div>
    </>

  return <ProjectShell header={header}>{children}</ProjectShell>
}
