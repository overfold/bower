import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectIntegrations,
  getServicesByProject,
  getEnvironmentsByProject,
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

  const [{ hooks, channels }, services, environments] = await Promise.all([
    getProjectIntegrations(project.id),
    getServicesByProject(project.id),
    getEnvironmentsByProject(project.id),
  ])

  const isAdmin = ctx.role === 'owner' || ctx.role === 'admin'

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionTitle>Webhooks</SectionTitle>
          {isAdmin && (
            <CreateWebhookDialog
              projectId={project.id}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
              environments={environments.map((e) => ({ id: e.id, name: e.name }))}
            />
          )}
        </div>

        {hooks.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Webhook className="h-4 w-4" />}
              title="No webhooks"
              body="No webhook endpoints configured."
            />
          </Panel>
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Deploy Mode</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[56px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {hooks.map((row) => (
                  <TableRow key={row.hook.id}>
                    <TableCell className="font-medium">
                      {row.serviceName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.environmentName}</Badge>
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
          <SectionTitle>Notification Channels</SectionTitle>
          {isAdmin && <CreateNotificationDialog projectId={project.id} />}
        </div>

        {channels.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Bell className="h-4 w-4" />}
              title="No notification channels"
              body="No notification channels configured."
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
