'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Search } from 'lucide-react'
import { CommandPalette } from '@/components/command-palette'
import { OrgTeamPicker } from '@/components/org-team-picker'
import { MobileDrawer } from '@/components/mobile-drawer'

const segmentLabels: Record<string, string> = {
  dashboard: 'Overview',
  projects: 'Projects',
  deployments: 'Deployments',
  status: 'Cluster',
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
  href: string
}

function deriveBreadcrumbs(pathname: string, data: HeaderBarProps['searchData']): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: 'Overview', href: '/dashboard' }]
  return segments.map((seg, i) => ({
    label: segments[0] === 'projects' && i === 1 ? data.projects.find((project) => project.slug === seg)?.name ?? prettifySlug(seg)
      : segments[0] === 'projects' && segments[2] === 'services' && i === 3 ? data.services.find((service) => service.projectSlug === segments[1] && service.slug === seg)?.name ?? prettifySlug(seg)
      : (segments[i - 1] === 'allocations' || segments[i - 1] === 'deployments') ? seg.slice(0, 8)
      : segments[0] === 'status' && i === 1 ? seg.slice(0, 8)
      : segments[0] === 'settings' && segments[1] === 'members' && i === 2 ? 'Member'
      : segmentLabels[seg] ?? prettifySlug(seg),
    href: '/' + segments.slice(0, i + 1).join('/'),
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
  }
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
}

export function HeaderBar({ orgs, currentOrg, teams, searchData, user }: HeaderBarProps) {
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
        <MobileDrawer user={user} />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <div className="min-w-0 max-w-[100px] shrink-0 sm:max-w-none"><OrgTeamPicker orgs={orgs} currentOrg={currentOrg} teams={teams} /></div>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-ink-faint ${i < crumbs.length - 1 ? "max-sm:hidden" : ""}`} />
              {i === crumbs.length - 1 ? (
                <span aria-current="page" title={crumb.label} className="min-w-0 truncate text-[13px] font-semibold text-ink">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="min-w-0 truncate text-[13px] font-medium text-ink-muted transition-colors hover:text-ink max-sm:hidden">
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          ))}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-[12.5px] text-ink-muted shadow-card transition-colors duration-150 hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:h-8 sm:w-48 sm:justify-start sm:px-2.5"
        >
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded border border-line bg-sunken px-1.5 py-px font-sans text-2xs md:inline">⌘K</kbd>
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
