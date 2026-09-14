import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug } from '@/lib/queries'
import { ProjectSettingsForm } from './project-settings-form'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()

  return (
    <ProjectSettingsForm
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        registryUrl: project.registryUrl,
        createdAt: project.createdAt.toISOString(),
      }}
    />
  )
}
