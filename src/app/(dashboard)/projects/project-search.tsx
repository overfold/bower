'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { BoxesIcon, SearchIcon } from 'lucide-react'
import { StatusDot } from '@/components/status'
import { Time } from '@/components/time'

interface ProjectRow {
  id: string
  name: string
  slug: string
  description: string | null
  updatedAt: string
  serviceCount: number
  routeCount: number
  healthStatus: string | null
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
      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted shadow-card transition-[border-color,box-shadow] duration-150 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                        className="rounded text-md font-semibold tracking-tight text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        {project.name}
                      </Link>
                      {project.healthStatus ? <StatusDot status={project.healthStatus} /> : <span className="text-xs text-ink-muted">Not deployed</span>}
                    </div>
                    {project.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                        {project.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
                      {project.serviceCount === 0 ? <Link className="text-link" href={`/projects/${project.slug}/services`}>Add a service</Link> : <span>{project.serviceCount} {project.serviceCount === 1 ? 'service' : 'services'}</span>}
                      <span>{project.routeCount} {project.routeCount === 1 ? 'route' : 'routes'}</span>
                      {project.latestDeployment && <span className="flex items-center gap-2">Last deploy <StatusDot status={project.latestDeployment.status} /> <Time value={project.latestDeployment.createdAt} /></span>}
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
