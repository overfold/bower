'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, MoreHorizontal, Search } from 'lucide-react'
import { CommandPalette } from '@/components/command-palette'
import { MobileDrawer } from '@/components/mobile-drawer'
import { OrgTeamPicker } from '@/components/org-team-picker'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const segmentLabels: Record<string, string> = {
  dashboard: 'Home',
  projects: 'Projects',
  deployments: 'Deployments',
  status: 'Status',
  settings: 'Settings',
  audit: 'Audit log',
  organization: 'Organization',
  members: 'Members',
  teams: 'Teams',
  cluster: 'Cluster',
  instance: 'Instance',
  account: 'Account',
  services: 'Services',
  environment: 'Environment',
  secrets: 'Secrets',
  routes: 'Routes',
  integrations: 'Integrations',
  revisions: 'History',
  allocations: 'Allocations',
  volumes: 'Volumes',
  advanced: 'Advanced',
  configuration: 'Configuration',
  access: 'Access',
  domains: 'Domains',
}

function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Crumb {
  label: string
  href?: string
}

function deriveBreadcrumbs(pathname: string, data: HeaderBarProps['searchData']): Crumb[] {
  const rawSegments = pathname.split('/').filter(Boolean)
  const serviceTabs = new Set(['environment', 'secrets', 'routes', 'integrations', 'revisions', 'allocations', 'volumes', 'advanced', 'configuration', 'access', 'mounts'])
  const segments = rawSegments[0] === 'projects' && rawSegments[2] === 'services' && serviceTabs.has(rawSegments.at(-1) ?? '')
    ? rawSegments.slice(0, -1)
    : rawSegments
  if (segments.length === 0) return [{ label: 'Home', href: '/dashboard' }]
  return segments.map((seg, i) => ({
    label: segments[0] === 'projects' && i === 1 ? data.projects.find((project) => project.slug === seg)?.name ?? seg
      : segments[0] === 'projects' && segments[2] === 'services' && i === 3 ? data.services.find((service) => service.projectSlug === segments[1] && service.slug === seg)?.name ?? seg
      : segments[i - 1] === 'deployments' ? data.deploymentLabels[seg] ?? `Deployment ${seg.slice(0, 8)}`
      : segments[0] === 'settings' && segments[1] === 'members' && i === 2 ? data.memberLabels[seg] ?? 'Member'
      : (segments[i - 1] === 'allocations' || (segments[0] === 'status' && i === 1)) ? seg
      : segmentLabels[seg] ?? prettifySlug(seg),
    href: seg === 'allocations' ? undefined : '/' + segments.slice(0, i + 1).join('/'),
  }))
}

interface OrgEntry {
  id: string
  name: string
  slug: string
  role: string
}

interface TeamEntry {
  id: string
  name: string
}

interface HeaderBarProps {
  orgs: OrgEntry[]
  currentOrg: OrgEntry
  teams: TeamEntry[]
  searchData: {
    projects: { id: string; name: string; slug: string; teamName?: string }[]
    services: { id: string; name: string; slug: string; projectName: string; projectSlug: string }[]
    orgName: string
    instanceAdmin: boolean
    deploymentLabels: Record<string, string>
    memberLabels: Record<string, string>
  }
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
}

export function HeaderBar({ orgs, currentOrg, teams, searchData, user, projects }: HeaderBarProps & {
  projects: { id: string; name: string; slug: string }[]
}) {
  const pathname = usePathname()
  const crumbs = deriveBreadcrumbs(pathname, searchData)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
        <MobileDrawer user={user} projects={projects} currentOrg={currentOrg} />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <OrgTeamPicker orgs={orgs} currentOrg={currentOrg} teams={teams} />
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1">
          {(crumbs.length > 4 ? [crumbs[0], ...crumbs.slice(-2)] : crumbs).map((crumb, i, visibleCrumbs) => (
            <Fragment key={`${crumb.label}-${i}`}>
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-ink-faint ${i < visibleCrumbs.length - 1 ? "max-sm:hidden" : ""}`} />
              {crumbs.length > 4 && i === 1 ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label="Show intermediate breadcrumb pages" className="rounded-md p-1 text-ink-muted hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface max-sm:hidden">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {crumbs.slice(1, -2).map((middle) => middle.href ? (
                        <DropdownMenuItem key={middle.href} asChild><Link href={middle.href}>{middle.label}</Link></DropdownMenuItem>
                      ) : <DropdownMenuItem key={middle.label} disabled>{middle.label}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint max-sm:hidden" />
                </>
              ) : null}
              {i === visibleCrumbs.length - 1 ? (
                <span aria-current="page" title={crumb.label} className="min-w-0 truncate text-sm font-semibold text-ink">{crumb.label}</span>
              ) : crumb.href ? (
                <Link title={crumb.label} href={crumb.href} className="min-w-0 max-w-[180px] truncate rounded-md text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface max-sm:hidden">
                  {crumb.label}
                </Link>
              ) : <span title={crumb.label} className="min-w-0 max-w-[180px] truncate text-sm font-medium text-ink-muted max-sm:hidden">{crumb.label}</span>}
            </Fragment>
          ))}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm text-ink-muted shadow-card transition-colors duration-150 hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:h-8 sm:w-48 sm:justify-start sm:px-2.5"
        >
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded-md border border-line bg-sunken px-1.5 py-px font-sans text-2xs md:inline">⌘K</kbd>
        </button>
      </header>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        projects={searchData.projects}
        services={searchData.services}
        orgName={searchData.orgName}
        instanceAdmin={searchData.instanceAdmin}
      />
    </>
  )
}
