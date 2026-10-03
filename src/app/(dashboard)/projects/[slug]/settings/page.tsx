import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServicesByProject, getRoutesByProject } from '@/lib/queries'
import { db } from '@/db'
import { projectVolumes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SectionTitle } from '@/components/ui/panel'
import { ProjectSettingsForm } from './project-settings-form'
import AccessSection from '../access/access-section'
import IntegrationsSection from '../integrations/integrations-section'
import VolumesSection from '../volumes/volumes-section'

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
    <div className="space-y-10">
      <section id="general" className="scroll-mt-6 space-y-6">
        <SectionTitle>General</SectionTitle>
        <ProjectSettingsForm
          counts={{ services: services.length, routes: routes.length, volumes: volumes.length }}
          project={{
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            createdAt: project.createdAt.toISOString(),
          }}
        />
      </section>
      <section id="access" className="scroll-mt-6 border-t border-line pt-8">
        <AccessSection params={params} />
      </section>
      <section id="integrations" className="scroll-mt-6 border-t border-line pt-8">
        <IntegrationsSection params={params} />
      </section>
      <section id="volumes" className="scroll-mt-6 border-t border-line pt-8">
        <VolumesSection params={params} />
      </section>
    </div>
  )
}
