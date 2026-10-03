import { notFound, redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'
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
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateSecretDialog } from './create-secret-dialog'
import { SecretActions } from './secret-actions'
import type { BowerSecretBinding } from '@/lib/job-builder'
import { Time } from '@/components/time'
import { VariablesSection } from '@/components/variables-section'

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
  const environmentVariables = recordEntries(environment.envVars)
  const variableServices = serviceRows.map(({ service, config }) => ({
    id: service.id,
    name: service.name,
    envVars: Object.fromEntries(recordEntries(config.envVars)),
    secretBindings: bindings(config.secretBindings),
  }))
  const secretLabels = Object.fromEntries(secrets.map((row) => [row.secret.trellisSecretName, row.secret.name]))

  return (
    <div className="space-y-6">
      <SectionTitle>Environment</SectionTitle>
      <div className="grid gap-5">
        <VariablesSection
          projectId={project.id}
          environmentId={environment.id}
          sharedNames={environmentVariables.map(([name]) => name)}
          services={variableServices}
          secretLabels={secretLabels}
          canManage={canManage}
        />

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
                      <TableCell className="text-ink-muted"><Time value={row.secret.lastRotatedAt} mode="auto" /></TableCell>
                      <TableCell className="text-right">{canManage ? <SecretActions projectId={project.id} secretId={row.secret.id} secretName={row.secret.trellisSecretName} /> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

    </div>
  )
}
