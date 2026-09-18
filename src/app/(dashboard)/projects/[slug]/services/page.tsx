import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServicesByProject } from '@/lib/queries'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { Server, Box } from 'lucide-react'

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')

  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')

  const services = await getServicesByProject(project.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle>Services</SectionTitle>
        <CreateServiceDialog projectSlug={slug} />
      </div>

      {services.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Server className="h-4 w-4" />}
            title="No services yet"
            body="Create your first service to start deploying containers with Trellis."
            action={<CreateServiceDialog projectSlug={slug} />}
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {services.map((service) => (
            <li key={service.id}>
              <Panel className="transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raised">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-ink-muted">
                      <Box className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/projects/${slug}/services/${service.slug}`}
                          className="rounded text-[14px] font-semibold tracking-tight text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                        >
                          {service.name}
                        </Link>
                      </div>
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Created{' '}
                        {new Date(service.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
