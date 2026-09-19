import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Box, KeyRound } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { requireProject } from '@/lib/actions/shared'
import {
  getProjectBySlug,
  getProjectEnvironment,
  getSecretsByProject,
  getServiceConfigs,
  getServicesByProject,
  getUserOrganization,
} from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateSecretDialog } from './create-secret-dialog'
import { SecretActions } from './secret-actions'
import { CreateEnvironmentVariableDialog, DeleteEnvironmentVariableButton } from './environment-variable-controls'
import { ServiceEnvironmentDialog } from './service-environment-dialog'
import type { BowerSecretBinding } from '@/lib/job-builder'

function formatDate(date: Date | string | null) {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function recordEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [] as Array<[string, string]>
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, String(entry)] as [string, string])
}

function bindings(value: unknown): BowerSecretBinding[] {
  return Array.isArray(value) ? value.filter((entry): entry is BowerSecretBinding => Boolean(entry && typeof entry === 'object' && 'name' in entry && 'target' in entry)) : []
}

export default async function EnvironmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const access = await requireProject(project.id)
  const canManage = access.projectRole === 'admin'

  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const [services, allSecrets] = await Promise.all([
    getServicesByProject(project.id),
    getSecretsByProject(project.id),
  ])
  const serviceRows = (await Promise.all(services.map(async (service) => {
    const configs = await getServiceConfigs(service.id)
    const config = configs.find((item) => item.environmentId === environment.id)
    return config ? { service, config } : null
  }))).filter((row): row is NonNullable<typeof row> => row !== null)
  const secrets = allSecrets.filter((row) => row.secret.environmentId === environment.id)
  const secretNames = secrets.map((row) => row.secret.trellisSecretName)
  const environmentVariables = recordEntries(environment.envVars)

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Environment</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">Manage variables and secrets shared by this project’s services.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Environment variables"
            hint={`${environmentVariables.length} ${environmentVariables.length === 1 ? 'variable' : 'variables'} injected into every service`}
            action={canManage ? <CreateEnvironmentVariableDialog projectId={project.id} environmentId={environment.id} /> : undefined}
          />
          {environmentVariables.length === 0 ? (
            <div className="p-4 text-[13px] text-ink-muted">No environment variables are configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {environmentVariables.map(([name]) => (
                    <TableRow key={name}>
                      <TableCell className="font-mono text-xs font-medium">{name}</TableCell>
                      <TableCell className="text-right">{canManage ? <DeleteEnvironmentVariableButton projectId={project.id} environmentId={environment.id} name={name} /> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Secrets"
            hint={`${secrets.length} ${secrets.length === 1 ? 'secret' : 'secrets'} available to services`}
            action={canManage ? <CreateSecretDialog projectId={project.id} environmentId={environment.id} /> : undefined}
          />
          {secrets.length === 0 ? (
            <EmptyState icon={<KeyRound className="h-4 w-4" />} title="No secrets" body="Add a secret, then bind it to a service below." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Rotated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {secrets.map((row) => (
                    <TableRow key={row.secret.id}>
                      <TableCell className="font-mono text-xs font-medium">{row.secret.name}</TableCell>
                      <TableCell className="text-ink-muted">{formatDate(row.secret.lastRotatedAt)}</TableCell>
                      <TableCell className="text-right">{canManage ? <SecretActions projectId={project.id} secretId={row.secret.id} /> : null}</TableCell>
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
          <SectionTitle>Service variables and secrets</SectionTitle>
          <p className="text-[13px] text-ink-muted">Configure variables and secret bindings that apply only to an individual service.</p>
        </div>
        {serviceRows.length === 0 ? (
          <Panel><EmptyState icon={<Box className="h-4 w-4" />} title="No services" body="Create a service to configure its variables and secrets." /></Panel>
        ) : (
          serviceRows.map(({ service, config }) => {
            const variables = recordEntries(config.envVars)
            const secretBindings = bindings(config.secretBindings)
            return (
              <Panel key={config.id}>
                <PanelHeader
                  title={service.name}
                  hint={`${variables.length} ${variables.length === 1 ? 'variable' : 'variables'} · ${secretBindings.length} ${secretBindings.length === 1 ? 'secret' : 'secrets'}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="sm"><Link href={`/projects/${slug}/services/${service.slug}`}>Open service</Link></Button>
                      {canManage ? <ServiceEnvironmentDialog
                        serviceId={service.id}
                        environmentId={environment.id}
                        serviceName={service.name}
                        envVars={config.envVars}
                        secretBindings={config.secretBindings}
                        secretNames={secretNames}
                      /> : null}
                    </div>
                  }
                />
                <div className="grid gap-0 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  <div className="p-4">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Variables</p>
                    {variables.length === 0 ? <p className="text-[13px] text-ink-muted">No service-specific variables.</p> : (
                      <div className="space-y-2.5">{variables.map(([name, value]) => <div key={name} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 text-[12.5px]"><span className="truncate font-mono font-medium text-ink">{name}</span><span className="truncate font-mono text-ink-muted">{value}</span></div>)}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Secret bindings</p>
                    {secretBindings.length === 0 ? <p className="text-[13px] text-ink-muted">No secrets are bound.</p> : (
                      <div className="space-y-2.5">{secretBindings.map((binding, index) => <div key={`${binding.name}-${index}`} className="flex items-center justify-between gap-4 text-[12.5px]"><span className="truncate font-mono font-medium text-ink">{binding.name}</span><span className="truncate font-mono text-ink-muted">{binding.target === 'env' ? binding.env : binding.path}</span></div>)}</div>
                    )}
                  </div>
                </div>
              </Panel>
            )
          })
        )}
      </div>
    </div>
  )
}
