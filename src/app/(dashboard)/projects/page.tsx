import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectsForUser, getServicesByProject } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { BoxesIcon, SearchIcon } from 'lucide-react'
import { ProjectSearch } from './project-search'

function relTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const clusterConfigured = Boolean(orgCtx.org.trellisApiUrl && orgCtx.org.trellisApiToken)
  const projectList = await getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role)

  const serviceCounts = await Promise.all(
    projectList.map(async (project) => {
      const svc = await getServicesByProject(project.id)
      return { projectId: project.id, count: svc.length }
    })
  )
  const serviceCountMap = new Map(serviceCounts.map((s) => [s.projectId, s.count]))

  const serializedProjects = projectList.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    registryUrl: p.registryUrl,
    updatedAt: p.updatedAt.toISOString(),
    serviceCount: serviceCountMap.get(p.id) ?? 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Projects"
        description="Each project groups services, environments, routes, and secrets."
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
                : 'Connect a Trellis cluster in Settings to start creating projects.'
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
