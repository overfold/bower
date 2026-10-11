'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { projectHealth } from '@/lib/project-health'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { ChevronRight, Folder } from 'lucide-react'
import { Chip } from '@/components/ui/badge'
import { Time } from '@/components/time'
import { plural } from '@/lib/format'

interface ProjectRow {
  id: string
  name: string
  slug: string
  description: string | null
  updatedAt: string
  serviceCount: number
  routeCount: number
  liveServices: { health: string }[]
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
      <Panel>
      <PanelHeader title={plural(projects.length, 'project')} hint="Projects and their current service health across the organization." action={projects.length > 8 ? <div className="max-w-xs">
        <SearchInput
          placeholder="Search"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div> : undefined} />

      {filtered.length === 0 ? (
        <>
          <EmptyState
            icon={<Folder className="h-4 w-4" />}
            title="No projects match that filter"
            body="Try a different name, or create a project to group your services and environments."
            action={clusterConfigured ? <CreateProjectDialog /> : undefined}
          />
        </>
      ) : (
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="border-b border-line bg-sunken"><th className="overline px-4 py-2">Project</th><th className="overline px-4 py-2">Health</th><th className="overline px-4 py-2">Services</th><th className="overline px-4 py-2">Routes</th><th className="overline px-4 py-2">Last deploy</th><th className="w-12"><span className="sr-only">Open</span></th></tr></thead><tbody>
          {filtered.map((project) => (
            <tr key={project.id} className="group relative border-b border-line last:border-0 hover:bg-sunken">
              <td className="px-4 py-3">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="rounded text-sm font-medium text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        {project.name}
                      </Link>
              </td>
              <td className="px-4 py-3"><Chip tone={projectHealth(project.liveServices).tone}>{projectHealth(project.liveServices).label}</Chip></td>
              <td className="px-4 py-3 text-sm text-ink-muted">{project.serviceCount}</td><td className="px-4 py-3 text-sm text-ink-muted">{project.routeCount}</td>
              <td className="px-4 py-3 text-sm text-ink-muted">{project.latestDeployment ? <Time value={project.latestDeployment.createdAt} /> : 'Never'}</td>
              <td className="px-4 py-3"><Link href={`/projects/${project.slug}`} aria-label={`Open ${project.name}`} className="absolute inset-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"><span className="sr-only">Open {project.name}</span></Link><ChevronRight className="ml-auto size-4 text-ink-faint" aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      </Panel>
    </>
  )
}
