import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectsForUser, getProjectSummaries } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { BoxesIcon } from 'lucide-react'
import { ProjectSearch } from './project-search'
import { hasTrellisConnection } from '@/lib/trellis-instance'

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const clusterConfigured = hasTrellisConnection(orgCtx.org)
  const projectList = await getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role)

  const summaries = await getProjectSummaries(projectList.map((project) => project.id))
  const summaryMap = new Map(summaries.map((summary) => [summary.projectId, summary]))

  const serializedProjects = projectList.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    updatedAt: p.updatedAt.toISOString(),
    serviceCount: summaryMap.get(p.id)?.serviceCount ?? 0,
    routeCount: summaryMap.get(p.id)?.routeCount ?? 0,
    healthStatus: summaryMap.get(p.id)?.healthStatus ?? null,
    latestDeployment: summaryMap.get(p.id)?.latestDeployment
      ? { ...summaryMap.get(p.id)!.latestDeployment!, createdAt: summaryMap.get(p.id)!.latestDeployment!.createdAt.toISOString() }
      : null,
  }))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Projects"
        description="Create and manage projects and their deployed services."
        actions={clusterConfigured ? <CreateProjectDialog /> : undefined}
      />

      {projectList.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<BoxesIcon className="h-4 w-4" />}
            title="No projects yet"
            body={
              clusterConfigured
                ? 'Create your first project to start deploying services.'
                : 'Connect a cluster in Settings to start creating projects.'
            }
            action={clusterConfigured ? <CreateProjectDialog /> : undefined}
          />
        </Panel>
      ) : (
        <ProjectSearch projects={serializedProjects} clusterConfigured={clusterConfigured} />
      )}
    </div>
  )
}
