import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServicesByProject, getRoutesByProject } from '@/lib/queries'
import { db } from '@/db'
import { projectVolumes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SectionTitle } from '@/components/ui/panel'
import { ProjectSettingsForm } from './project-settings-form'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const [services, routes, volumes] = await Promise.all([
    getServicesByProject(project.id),
    getRoutesByProject(project.id),
    db.select({ id: projectVolumes.id }).from(projectVolumes).where(eq(projectVolumes.projectId, project.id)),
  ])

  return (
    <div className="space-y-6">
      <div><SectionTitle>Project settings</SectionTitle><p className="mt-1 max-w-3xl text-sm text-ink-muted">Update project details or permanently remove this project.</p></div>
      <ProjectSettingsForm
        counts={{ services: services.length, routes: routes.length, volumes: volumes.length }}
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt.toISOString(),
        }}
      />
    </div>
  )
}
