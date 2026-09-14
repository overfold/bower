import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Box, KeyRound, Lock, Unlock } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import {
  getDeploymentsByProject,
  getEnvironmentsByProject,
  getProjectBySlug,
  getSecretsByProject,
  getServiceConfigs,
  getServicesByProject,
  getUserOrganization,
} from '@/lib/queries'
import { toggleEnvironmentLockAction } from '@/lib/actions/operations'
import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle, KeyValue } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip, StatusDot } from '@/components/status'
import { CreateSecretDialog } from '../../secrets/create-secret-dialog'
import { SecretActions } from '../../secrets/secret-actions'
import { EnvironmentSettingsDialog } from './environment-settings-dialog'
import { ServiceEnvironmentDialog } from './service-environment-dialog'
import type { BowerSecretBinding } from '@/lib/job-builder'

function formatDate(date: Date | string | null) {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function recordEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [] as Array<[string, string]>
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, String(entry)] as [string, string])
}

function bindings(value: unknown): BowerSecretBinding[] {
  return Array.isArray(value) ? value.filter((entry): entry is BowerSecretBinding => Boolean(entry && typeof entry === 'object' && 'name' in entry && 'target' in entry)) : []
}

export default async function EnvironmentDetailPage({ params }: { params: Promise<{ slug: string; environmentSlug: string }> }) {
  const { slug, environmentSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()

  const environments = await getEnvironmentsByProject(project.id)
  const environment = environments.find((item) => item.slug === environmentSlug)
  if (!environment) notFound()

  const [services, allSecrets, allDeployments] = await Promise.all([
    getServicesByProject(project.id),
    getSecretsByProject(project.id),
    getDeploymentsByProject(project.id, 100),
  ])
  const serviceRows = (await Promise.all(services.map(async (service) => {
    const configs = await getServiceConfigs(service.id)
    const config = configs.find((item) => item.environmentId === environment.id)
    return config ? { service, config } : null
  }))).filter((row): row is NonNullable<typeof row> => row !== null)
  const secrets = allSecrets.filter((row) => row.secret.environmentId === environment.id)
  const secretNames = secrets.map((row) => row.secret.trellisSecretName)
  const deployments = allDeployments.filter((row) => row.deployment.environmentId === environment.id).slice(0, 10)
  const sharedVariables = recordEntries(environment.envVars)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/projects/${slug}/environments`} className="mt-2 text-ink-muted transition-colors hover:text-ink" aria-label="Back to environments">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeading
            eyebrow={<Chip tone="neutral">Environment</Chip>}
            title={environment.name}
            meta={
              <>
                <span className="font-mono text-[11.5px] text-ink-muted">{environment.trellisNamespace}</span>
                {environment.isLocked ? <Chip tone="warn">Locked</Chip> : <Chip tone="neutral">Unlocked</Chip>}
              </>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <EnvironmentSettingsDialog
                  projectId={project.id}
                  environment={{
                    id: environment.id,
                    defaultReplicas: environment.defaultReplicas,
                    promotionOrder: environment.promotionOrder,
                    resourceTier: environment.resourceTier,
                    envVarNames: sharedVariables.map(([name]) => name),
                  }}
                />
                <form action={toggleEnvironmentLockAction.bind(null, project.id, environment.id, !environment.isLocked)}>
                  <Button variant="default" size="sm" type="submit">
                    {environment.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {environment.isLocked ? 'Unlock' : 'Lock'}
                  </Button>
                </form>
              </div>
            }
          />
        </div>
      </div>

      <Panel>
        <PanelHeader title="Environment defaults" hint="Inherited by services unless their configuration overrides them" />
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
            <KeyValue label="Namespace" mono>{environment.trellisNamespace}</KeyValue>
            <KeyValue label="Resource tier"><span className="capitalize">{environment.resourceTier}</span></KeyValue>
            <KeyValue label="Default replicas">{environment.defaultReplicas}</KeyValue>
            <KeyValue label="Promotion order">{environment.promotionOrder}</KeyValue>
          </dl>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Shared environment variables" hint="Secret-backed values injected into every service" />
          {sharedVariables.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-muted">No shared variables are configured.</div>
          ) : (
            <div className="divide-y divide-line">
              {sharedVariables.map(([name]) => (
                <div key={name} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="font-mono text-[12.5px] font-medium text-ink">{name}</span>
                  <Chip tone="neutral">Secret-backed</Chip>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Secrets"
            hint={`${secrets.length} ${secrets.length === 1 ? 'secret' : 'secrets'} available in this environment`}
            action={<CreateSecretDialog projectId={project.id} environments={[{ id: environment.id, name: environment.name }]} />}
          />
          {secrets.length === 0 ? (
            <EmptyState icon={<KeyRound className="h-4 w-4" />} title="No secrets" body="Add a secret, then bind it to a service below." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Shared group</TableHead>
                    <TableHead>Rotated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((row) => (
                    <TableRow key={row.secret.id}>
                      <TableCell className="font-mono text-xs font-medium">{row.secret.name}</TableCell>
                      <TableCell className="text-ink-muted">{row.sharedName ?? '—'}</TableCell>
                      <TableCell className="text-ink-muted">{formatDate(row.secret.lastRotatedAt)}</TableCell>
                      <TableCell className="text-right"><SecretActions projectId={project.id} secretId={row.secret.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <SectionTitle>Service configuration</SectionTitle>
          <p className="text-[13px] text-ink-muted">Environment-specific service values and secret bindings live here; service-wide execution settings stay with the service.</p>
        </div>
        {serviceRows.length === 0 ? (
          <Panel>
            <EmptyState icon={<Box className="h-4 w-4" />} title="No services" body="Services configured for this environment will appear here." />
          </Panel>
        ) : (
          serviceRows.map(({ service, config }) => {
            const variables = recordEntries(config.envVars)
            const secretBindings = bindings(config.secretBindings)
            return (
              <Panel key={config.id}>
                <PanelHeader
                  title={service.name}
                  hint={`${config.image} · ${config.replicas} ${config.replicas === 1 ? 'replica' : 'replicas'}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${slug}/services/${service.slug}`}>
                        <Button variant="ghost" size="sm">Open service</Button>
                      </Link>
                      <ServiceEnvironmentDialog
                        serviceId={service.id}
                        environmentId={environment.id}
                        serviceName={service.name}
                        envVars={config.envVars}
                        secretBindings={config.secretBindings}
                        secretNames={secretNames}
                      />
                    </div>
                  }
                />
                <div className="grid gap-0 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  <div className="p-4">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Variables</p>
                    {variables.length === 0 ? (
                      <p className="text-[13px] text-ink-muted">No service-specific variables.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {variables.map(([name, value]) => (
                          <div key={name} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 text-[12.5px]">
                            <span className="truncate font-mono font-medium text-ink">{name}</span>
                            <span className="truncate font-mono text-ink-muted">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Secret bindings</p>
                    {secretBindings.length === 0 ? (
                      <p className="text-[13px] text-ink-muted">No secrets are bound.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {secretBindings.map((binding, index) => (
                          <div key={`${binding.name}-${index}`} className="flex items-center justify-between gap-4 text-[12.5px]">
                            <span className="truncate font-mono font-medium text-ink">{binding.name}</span>
                            <span className="truncate font-mono text-ink-muted">
                              {binding.target === 'env' ? binding.env : binding.path}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            )
          })
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle>Recent deployments</SectionTitle>
        {deployments.length === 0 ? (
          <Panel><div className="p-5 text-[13px] text-ink-muted">No deployments have targeted this environment yet.</div></Panel>
        ) : (
          <Panel>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((row) => (
                    <TableRow key={row.deployment.id}>
                      <TableCell><StatusDot status={row.deployment.status} /></TableCell>
                      <TableCell>
                        <Link href={`/projects/${slug}/services/${row.serviceSlug}`} className="font-medium text-ink hover:text-brand-500">{row.serviceName}</Link>
                      </TableCell>
                      <TableCell className="max-w-64 truncate font-mono text-xs text-ink-muted">{row.deployment.imageAfter}</TableCell>
                      <TableCell className="whitespace-nowrap text-ink-muted">{formatDateTime(row.deployment.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
