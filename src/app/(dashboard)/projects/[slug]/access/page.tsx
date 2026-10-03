import { redirect } from 'next/navigation'

export default async function AccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/projects/${slug}/settings#access`)
}
