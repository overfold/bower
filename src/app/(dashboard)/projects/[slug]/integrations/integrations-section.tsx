import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectIntegrations,
  getServicesByProject,
  getProjectEnvironment,
} from '@/lib/queries'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Chip } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Webhook, Bell } from 'lucide-react'
import {
  CreateWebhookDialog, DeleteWebhookButton,
  CreateNotificationDialog, DeleteNotificationButton,
} from './integration-actions'
import { deployModeLabels, providerLabels } from '@/lib/labels'

export default async function IntegrationsSection({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/no-organization')

  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')

  const [{ hooks, channels }, services, environment] = await Promise.all([
    getProjectIntegrations(project.id),
    getServicesByProject(project.id),
    getProjectEnvironment(project.id),
  ])
  const visibleHooks = environment ? hooks.filter((row) => row.hook.environmentId === environment.id) : []

  const isAdmin = ctx.role === 'owner' || ctx.role === 'admin'

  return (
    <div className="space-y-8">
      <SectionTitle>Integrations</SectionTitle>
      <Panel>
        <PanelHeader title="Webhooks" hint={`${visibleHooks.length} ${visibleHooks.length === 1 ? 'webhook' : 'webhooks'}`} action={isAdmin && environment ? (
            <CreateWebhookDialog
              projectId={project.id}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
              environmentId={environment.id}
            />
          ) : undefined} />

        {visibleHooks.length === 0 ? (
            <EmptyState
              icon={<Webhook className="h-4 w-4" />}
              title="No webhooks"
              body={!isAdmin ? 'Project administrator access is required to add a webhook.' : !environment ? 'Create a project environment before adding a webhook.' : services.length === 0 ? 'Create a service before adding a webhook.' : 'Add a webhook to trigger deployments automatically.'}
              action={isAdmin && environment && services.length > 0 ? <CreateWebhookDialog projectId={project.id} services={services.map((s) => ({ id: s.id, name: s.name }))} environmentId={environment.id} /> : undefined}
            />
        ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Deploy mode</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[56px]"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleHooks.map((row) => (
                  <TableRow key={row.hook.id}>
                    <TableCell className="font-medium">
                      {row.serviceName}
                    </TableCell>
                    <TableCell>{providerLabels[row.hook.provider]}</TableCell>
                    <TableCell className="text-sm text-ink-muted">
                      {deployModeLabels[row.hook.deployMode]}
                    </TableCell>
                    <TableCell>
                      <Chip tone={row.hook.isActive ? 'success' : 'neutral'}>
                        {row.hook.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteWebhookButton projectId={project.id} hookId={row.hook.id} serviceName={row.serviceName} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Notification channels" hint={`${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}`} action={isAdmin ? <CreateNotificationDialog projectId={project.id} /> : undefined} />

        {channels.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-4 w-4" />}
              title="No notification channels"
              body={isAdmin ? 'Add a channel to receive deployment notifications.' : 'Project administrator access is required to add a notification channel.'}
              action={isAdmin ? <CreateNotificationDialog projectId={project.id} /> : undefined}
            />
        ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[56px]"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell className="capitalize">{channel.type}</TableCell>
                    <TableCell>
                      <Chip tone={channel.isActive ? 'success' : 'neutral'}>
                        {channel.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteNotificationButton projectId={project.id} channelId={channel.id} channelName={channel.name} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
        )}
      </Panel>
    </div>
  )
}
