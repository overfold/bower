import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Network } from 'lucide-react'
import { db } from '@/db'
import { serviceAdvancedSettings } from '@/db/service-advanced-schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getServiceBySlug, getServiceConfig, getUserOrganization } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Chip } from '@/components/status'
import { ServiceHeader } from '../service-header'
import { AdvancedConfigForm } from './advanced-config-form'

export default async function AdvancedPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()
  const config = await getServiceConfig(service.id)
  if (!config) notFound()
  const [advanced] = await db.select().from(serviceAdvancedSettings)
    .where(eq(serviceAdvancedSettings.serviceConfigId, config.id)).limit(1)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-2">
        <SectionTitle>Advanced execution</SectionTitle>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Runtime and workload API credentials are part of the service definition. They apply consistently wherever this service is deployed.
        </p>
      </div>

      <Panel>
        <PanelHeader title="Execution" hint="Task-group execution settings" />
        <AdvancedConfigForm
          serviceId={service.id}
          runtime={advanced?.runtime}
          apiAccessScope={advanced?.apiAccessScope}
          apiAccessLevel={advanced?.apiAccessLevel}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Networking" hint="Managed by Bower" action={<Chip tone="neutral">namespace</Chip>} />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-ink-muted">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink">Application workloads always use Trellis namespace networking.</p>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
                Bower does not expose host or isolated workload modes. Public connectivity is configured through project Routes, while each deployment runs on its environment&apos;s private Trellis namespace network.
              </p>
            </div>
          </div>
          <Link href={`/projects/${slug}/routes`} className="shrink-0">
            <Button variant="default" size="sm">Manage routes</Button>
          </Link>
        </div>
      </Panel>
    </div>
  )
}
