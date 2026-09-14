import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
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
import { Chip } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Settings, Rocket } from 'lucide-react'

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
    { label: 'Secrets', href: '/secrets' },
    { label: 'Routes', href: '/routes' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Access', href: '/access' },
    { label: 'Settings', href: '/settings' },
  ]

  return (
    <div className="space-y-0">
      <PageHeading
        eyebrow={
          <Chip tone="neutral">Project</Chip>
        }
        title={project.name}
        description={project.description ?? undefined}
        meta={
          <>
            {project.registryUrl && (
              <MetaItem
                label="Registry"
                value={<span className="font-mono text-[11.5px]">{project.registryUrl}</span>}
              />
            )}
            <MetaItem label="Services" value={services.length} />
            <MetaItem label="Environments" value={environments.length} />
            <MetaItem label="Last deploy" value={lastDeploy} />
          </>
        }
        actions={
          <>
            <Link href={`/projects/${slug}/settings`}>
              <Button variant="default" size="sm">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </>
        }
      />
      <div className="mt-6 border-b border-line">
        <ProjectTabs slug={slug} tabs={tabs} />
      </div>
      <div className="pt-6">{children}</div>
    </div>
  )
}
