'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { BoxesIcon } from 'lucide-react'
import { StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { LastDeployFailed } from '@/components/last-deploy-failed'

interface ProjectRow {
  id: string
  name: string
  slug: string
  description: string | null
  updatedAt: string
  serviceCount: number
  routeCount: number
  healthStatus: string | null
  failedDeployments: { id: string; serviceName: string }[]
  latestDeployment: { status: string; createdAt: string } | null
}

export function ProjectSearch({
  projects,
  clusterConfigured,
}: {
  projects: ProjectRow[]
  clusterConfigured: boolean
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    )
  }, [query, projects])

  return (
    <>
      <div className="max-w-xs">
        <SearchInput
          placeholder="Filter projects"
          aria-label="Filter projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<BoxesIcon className="h-4 w-4" />}
            title="No projects match that filter"
            body="Try a different name, or create a project to group your services and environments."
            action={clusterConfigured ? <CreateProjectDialog /> : undefined}
          />
        </Panel>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {filtered.map((project) => (
            <li key={project.id}>
              <Panel className="transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raised">
                <div className="flex flex-wrap items-start gap-x-8 gap-y-4 p-4">
                  <div className="min-w-0 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="rounded text-md font-semibold tracking-tight text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        {project.name}
                      </Link>
                      {project.healthStatus ? <StatusDot status={project.healthStatus} /> : <span className="text-xs text-ink-muted">Not deployed</span>}
                      {project.failedDeployments.map((deployment) => <LastDeployFailed key={deployment.id} href={`/projects/${project.slug}/deployments/${deployment.id}`} />)}
                    </div>
                    {project.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                        {project.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
                      {project.serviceCount === 0 ? <Link className="text-link" href={`/projects/${project.slug}/services`}>Add a service</Link> : <span>{project.serviceCount} {project.serviceCount === 1 ? 'service' : 'services'}</span>}
                      <span>{project.routeCount} {project.routeCount === 1 ? 'route' : 'routes'}</span>
                      {project.latestDeployment && <span className="flex items-center gap-2">Last deploy <Time value={project.latestDeployment.createdAt} /></span>}
                      <span>updated <Time value={project.updatedAt} /></span>
                    </div>
                  </div>

                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
