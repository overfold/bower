import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getEnvironmentsByProject,
} from '@/lib/queries'
import { Panel, SectionTitle } from '@/components/ui/panel'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Layers } from 'lucide-react'
import { CreateEnvironmentDialog } from './create-environment-dialog'

export default async function EnvironmentsPage({
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

  const environments = await getEnvironmentsByProject(project.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionTitle>Environments</SectionTitle>
          <p className="mt-1 text-[13px] text-ink-muted">Own environment variables, secrets, and environment-specific service configuration.</p>
        </div>
        <CreateEnvironmentDialog projectId={project.id} />
      </div>

      {environments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Layers className="h-4 w-4" />}
            title="No environments"
            body="Create an environment to begin configuring deployments."
          />
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {environments.map((env) => (
                  <TableRow key={env.id}>
                    <TableCell>
                      <Link href={`/projects/${slug}/environments/${env.slug}`} className="font-medium text-ink transition-colors hover:text-brand-500">
                        {env.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted">
                      {env.trellisNamespace}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  )
}
