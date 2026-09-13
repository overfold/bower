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
  environments: 'Environments',
  secrets: 'Secrets',
  routes: 'Routes',
  integrations: 'Integrations',
  revisions: 'Revisions',
  allocations: 'Allocations',
}

function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Crumb {
  label: string
  href: string
}

function deriveBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: 'Overview', href: '/dashboard' }]
  return segments.map((seg, i) => ({
    label: segmentLabels[seg] ?? prettifySlug(seg),
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
  }
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
}

export function HeaderBar({ orgs, currentOrg, teams, searchData, user }: HeaderBarProps) {
  const pathname = usePathname()
  const crumbs = deriveBreadcrumbs(pathname)
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
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
        <MobileDrawer user={user} />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <OrgTeamPicker orgs={orgs} currentOrg={currentOrg} teams={teams} />
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              {i === crumbs.length - 1 ? (
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="min-w-0 truncate text-[13px] font-medium text-ink-muted transition-colors hover:text-ink">
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-ink-muted shadow-card transition-colors duration-150 hover:border-line-strong hover:text-ink"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="ml-3 rounded border border-line bg-sunken px-1.5 py-px font-sans text-2xs">⌘K</kbd>
        </button>
      </header>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        projects={searchData.projects}
        services={searchData.services}
        orgName={searchData.orgName}
      />
    </>
  )
}
