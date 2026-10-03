import { redirect } from 'next/navigation'

export default async function AdvancedPage({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
}) {
  const { slug, serviceSlug } = await params
  redirect(`/projects/${slug}/services/${serviceSlug}/configuration#advanced`)
}
