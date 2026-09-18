import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectIntegrations,
  getServicesByProject,
  getProjectEnvironment,
} from '@/lib/queries'
import { Panel, SectionTitle } from '@/components/ui/panel'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Webhook, Bell } from 'lucide-react'
import {
  CreateWebhookDialog, DeleteWebhookButton,
  CreateNotificationDialog, DeleteNotificationButton,
} from './integration-actions'

export default async function IntegrationsPage({
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

  const [{ hooks, channels }, services, environment] = await Promise.all([
    getProjectIntegrations(project.id),
    getServicesByProject(project.id),
    getProjectEnvironment(project.id),
  ])
  const visibleHooks = environment ? hooks.filter((row) => row.hook.environmentId === environment.id) : []

  const isAdmin = ctx.role === 'owner' || ctx.role === 'admin'

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Webhooks</SectionTitle>
            <p className="mt-1 text-[13px] text-ink-muted">Trigger service deployments when your source provider sends an event.</p>
          </div>
          {isAdmin && environment && (
            <CreateWebhookDialog
              projectId={project.id}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
              environmentId={environment.id}
            />
          )}
        </div>

        {visibleHooks.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Webhook className="h-4 w-4" />}
              title="No webhooks"
              body="Add a webhook to trigger deployments automatically."
            />
          </Panel>
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Deploy mode</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[56px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleHooks.map((row) => (
                  <TableRow key={row.hook.id}>
                    <TableCell className="font-medium">
                      {row.serviceName}
                    </TableCell>
                    <TableCell className="capitalize">
                      {row.hook.provider}
                    </TableCell>
                    <TableCell className="text-sm text-ink-muted">
                      {row.hook.deployMode.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.hook.isActive ? 'success' : 'outline'}>
                        {row.hook.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteWebhookButton projectId={project.id} hookId={row.hook.id} serviceName={row.serviceName} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Notification channels</SectionTitle>
            <p className="mt-1 text-[13px] text-ink-muted">Send deployment updates to the tools your team already uses.</p>
          </div>
          {isAdmin && <CreateNotificationDialog projectId={project.id} />}
        </div>

        {channels.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Bell className="h-4 w-4" />}
              title="No notification channels"
              body="Add a channel to receive deployment notifications."
            />
          </Panel>
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[56px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {channel.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={channel.isActive ? 'success' : 'outline'}>
                        {channel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteNotificationButton projectId={project.id} channelId={channel.id} channelName={channel.name} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </div>
    </div>
  )
}
