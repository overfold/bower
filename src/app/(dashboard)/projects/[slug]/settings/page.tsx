import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServicesByProject, getRoutesByProject } from '@/lib/queries'
import { db } from '@/db'
import { projectVolumes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SectionTitle } from '@/components/ui/panel'
import { ProjectDangerZone, ProjectSettingsForm } from './project-settings-form'
import { SettingsAnchorNav } from '@/components/settings-anchor-nav'
import AccessSection from '../access/access-section'
import IntegrationsSection from '../integrations/integrations-section'
import VolumesSection from '../volumes/volumes-section'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/no-organization')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const [services, routes, volumes] = await Promise.all([
    getServicesByProject(project.id),
    getRoutesByProject(project.id),
    db.select({ id: projectVolumes.id }).from(projectVolumes).where(eq(projectVolumes.projectId, project.id)),
  ])

  const settingsProject = { id: project.id, name: project.name, slug: project.slug, description: project.description, createdAt: project.createdAt.toISOString() }
  const counts = { services: services.length, routes: routes.length, volumes: volumes.length }
  const sections = [{ id: 'general', label: 'General' }, { id: 'access', label: 'Access' }, { id: 'integrations', label: 'Integrations' }, { id: 'volumes', label: 'Volumes' }, { id: 'danger', label: 'Danger zone' }]
  return (
    <div className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="hidden lg:block"><SettingsAnchorNav items={sections} /></div>
      <div className="min-w-0 space-y-10">
      <section id="general" className="scroll-mt-6 space-y-6">
        <SectionTitle>General</SectionTitle>
        <ProjectSettingsForm
          counts={counts}
          project={settingsProject}
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
      <section id="danger" className="scroll-mt-6 border-t border-line pt-8">
        <ProjectDangerZone project={settingsProject} counts={counts} />
      </section>
      </div>
    </div>
  )
}
