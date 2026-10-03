'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Brand } from '@/components/brand'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/auth-actions'
import {
  LayoutDashboard,
  Folder,
  ScrollText,
  Settings,
  Server,
  History,
  UserCircle,
  LogOut,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: Folder },
  { label: 'Deployments', href: '/deployments', icon: History },
  { label: 'Status', href: '/status', icon: Server },
  { label: 'Audit log', href: '/audit', icon: ScrollText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface SidebarUser {
  name: string
  email: string
  avatarUrl: string | null
}

interface SidebarProps {
  user: SidebarUser
  projects?: { id: string; name: string; slug: string }[]
  currentOrg?: { id: string; name: string; slug: string; role: string }
}

export function SidebarContent({ user, onNavigate, projects = [], currentOrg }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [recentSlugs, setRecentSlugs] = useState<string[]>([])
  const recentKey = `bower-recent-projects.${currentOrg?.id ?? ''}.${user.email}`
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(recentKey) || '[]')
      const slugs = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []
      const current = pathname.match(/^\/projects\/([^/]+)/)?.[1]
      const next = current && projects.some((project) => project.slug === current) ? [current, ...slugs.filter((slug) => slug !== current)].slice(0, 5) : slugs
      localStorage.setItem(recentKey, JSON.stringify(next))
      const frame = requestAnimationFrame(() => setRecentSlugs(next))
      return () => cancelAnimationFrame(frame)
    } catch { /* Storage can be unavailable. */ }
  }, [pathname, recentKey, projects])
  const recentProjects = [
    ...recentSlugs.flatMap((slug) => projects.filter((project) => project.slug === slug)),
    ...projects.filter((project) => !recentSlugs.includes(project.slug)),
  ].slice(0, 5)

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" onClick={onNavigate} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <Brand size="sm" />
        </Link>
      </div>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 scroll-thin">
        {([['Workspace', navItems.slice(0, 3)], ['Platform', navItems.slice(3)] ] as const).map(([label, items]) => <div key={label} className="mb-4 space-y-0.5">
          {label === 'Platform' && recentProjects.length ? <div className="mb-4 space-y-0.5"><p className="overline px-2.5 pb-1">Recent projects</p>{recentProjects.map((project) => <Link key={project.id} href={`/projects/${project.slug}`} onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-soft hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><Folder className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{project.name}</span></Link>)}</div> : null}
          <p className="overline px-2.5 pb-1">{label}</p>
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-soft hover:bg-sunken hover:text-ink'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>)}
      </nav>

      <Separator className="bg-line" />

      <div className="shrink-0 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Profile menu"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface data-[state=open]:bg-sunken"
              >
                <Avatar className="h-6 w-6">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                  <span className="block truncate text-2xs text-ink-muted">{user.email}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={20} className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <DropdownMenuItem asChild>
                <Link href="/settings/account" onClick={onNavigate} className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={logoutAction} className="w-full">
                <DropdownMenuItem asChild>
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  )
}

export function Sidebar({ user, projects, currentOrg }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-line bg-surface lg:flex">
      <SidebarContent user={user} projects={projects} currentOrg={currentOrg} />
    </aside>
  )
}
