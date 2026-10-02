import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getDeploymentsByProject, getProjectEnvironment } from '@/lib/queries'
import { DeploymentPoller } from '@/components/deployment-poller'
import { SectionTitle } from '@/components/ui/panel'
import { DeploymentFilters } from '../../../deployments/deployment-filters'

export default async function DeploymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')
  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')
  const environment = await getProjectEnvironment(project.id)
  const rows = environment ? await getDeploymentsByProject(project.id, null, environment.id) : []
  const items = rows.map((row) => ({ ...row, projectName: project.name, projectSlug: slug }))

  return (
    <div className="space-y-5">
      <div><SectionTitle>Deployment history</SectionTitle><p className="mt-1 text-sm text-ink-muted">Review deployments for every service in this project.</p></div>
      <DeploymentPoller active={rows.some((row) => ['pending', 'planning', 'deploying', 'rolling_back'].includes(row.deployment.status))} />
      <DeploymentFilters scope="project" items={items} projects={[project.name]} environments={environment ? [environment.name] : []} />
    </div>
  )
}
