import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getServicesByProject,
  getEnvironmentsByProject,
  getDeploymentsByProject,
} from '@/lib/queries'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { ProjectTabs } from '@/components/project-tabs'
import { EnvironmentPicker } from '@/components/environment-picker'

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

  const [services, environments, deployments] = await Promise.all([
    getServicesByProject(project.id),
    getEnvironmentsByProject(project.id),
    getDeploymentsByProject(project.id, 1),
  ])

  const lastDeploy = deployments[0]
    ? new Date(deployments[0].deployment.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'never'

  const tabs = [
    { label: 'Overview', href: '' },
    { label: 'Services', href: '/services', count: services.length },
    { label: 'Deployments', href: '/deployments', count: undefined },
    { label: 'Environments', href: '/environments', count: environments.length },
    { label: 'Volumes', href: '/volumes' },
    { label: 'Routes', href: '/routes' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Access', href: '/access' },
    { label: 'Settings', href: '/settings' },
  ]

  return (
    <div className="space-y-0">
      <PageHeading
        title={project.name}
        description={project.description ?? undefined}
        meta={
          <>
            <MetaItem label="Services" value={services.length} />
            <MetaItem label="Environments" value={environments.length} />
            <MetaItem label="Last deploy" value={lastDeploy} />
          </>
        }
        actions={
          <Suspense>
            <EnvironmentPicker
              environments={environments.map((env) => ({ id: env.id, name: env.name }))}
            />
          </Suspense>
        }
      />
      <div className="mt-6 border-b border-line">
        <ProjectTabs slug={slug} tabs={tabs} />
      </div>
      <div className="pt-6">{children}</div>
    </div>
  )
}
