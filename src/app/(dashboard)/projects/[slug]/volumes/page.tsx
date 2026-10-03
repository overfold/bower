import { redirect } from 'next/navigation'

export default async function ProjectVolumesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/projects/${slug}/settings#volumes`)
}
