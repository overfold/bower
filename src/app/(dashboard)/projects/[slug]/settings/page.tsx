import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug } from '@/lib/queries'
import { ProjectSettingsForm } from './project-settings-form'
import { SectionTitle } from '@/components/ui/panel'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Settings</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">Update project details or permanently remove this project.</p>
      </div>
      <ProjectSettingsForm
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
