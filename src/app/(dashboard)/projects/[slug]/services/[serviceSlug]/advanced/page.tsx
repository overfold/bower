import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Network } from 'lucide-react'
import { db } from '@/db'
import { serviceAdvancedSettings } from '@/db/service-advanced-schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getServiceBySlug, getEnvironmentsByProject, getUserOrganization } from '@/lib/queries'
import { getServiceConfigsWithEnvironments } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Chip } from '@/components/status'
import { ServiceHeader } from '../service-header'
import { AdvancedConfigForm } from './advanced-config-form'
import { Box } from 'lucide-react'

export default async function AdvancedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, serviceSlug } = await params
  const { env: envParam } = await searchParams
  const environmentId = typeof envParam === 'string' ? envParam : null

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const environments = await getEnvironmentsByProject(project.id)
  const selectedEnv = environmentId ? environments.find((e) => e.id === environmentId) ?? null : null

  let advancedRow: { id: string; runtime: string; apiAccessScope: string | null; apiAccessLevel: string | null } | null = null
  let configId: string | null = null

  if (selectedEnv) {
    const configs = await getServiceConfigsWithEnvironments(service.id)
    const envConfigRow = configs.find(({ environment }) => environment.id === selectedEnv.id)
    if (envConfigRow) {
      configId = envConfigRow.config.id
      const [adv] = await db.select().from(serviceAdvancedSettings).where(eq(serviceAdvancedSettings.serviceConfigId, envConfigRow.config.id)).limit(1)
      advancedRow = adv ?? null
    }
  }

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-2">
        <SectionTitle>Advanced execution</SectionTitle>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Runtime and workload API credentials are lower-frequency execution controls. They are configured per environment and applied on the next deployment.
        </p>
      </div>

      <div className="space-y-4">
        {!selectedEnv ? (
          <Panel>
            <EmptyState
              icon={<Box className="h-4 w-4" />}
              title="Select an environment"
              body="Advanced execution settings are per-environment. Select an environment from the picker above."
            />
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title={selectedEnv.name}
              hint="Task-group execution settings"
            />
            {configId ? (
              <AdvancedConfigForm
                serviceId={service.id}
                environmentId={selectedEnv.id}
                runtime={advancedRow?.runtime}
                apiAccessScope={advancedRow?.apiAccessScope}
                apiAccessLevel={advancedRow?.apiAccessLevel}
              />
            ) : (
              <div className="p-4 text-[13px] text-ink-muted">No service configuration found for this environment.</div>
            )}
          </Panel>
        )}
      </div>

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
                Bower does not expose host or isolated workload modes. Public connectivity is configured through project Routes, while services remain on their environment&apos;s private Trellis namespace network.
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
