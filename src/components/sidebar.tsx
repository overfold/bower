'use client'

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
  FolderKanban,
  Rocket,
  Activity,
  ScrollText,
  Settings,
  Ellipsis,
  UserCircle,
  LogOut,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Deployments', href: '/deployments', icon: Rocket },
  { label: 'Status', href: '/status', icon: Activity },
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
}

export function SidebarContent({ user, onNavigate }: { user: SidebarUser; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" onClick={onNavigate} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
          <Brand size="sm" />
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 scroll-thin">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-soft hover:bg-black/[0.035] hover:text-ink'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <Separator className="bg-line" />

      <div className="shrink-0 p-2">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <Avatar className="h-6 w-6">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-ink text-2xs font-semibold text-white">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">{user.name}</p>
            <p className="truncate text-2xs text-ink-muted">{user.email}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-black/[0.035] hover:text-ink"
              >
                <Ellipsis className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-44">
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
    </div>
  )
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-line bg-surface lg:flex">
      <SidebarContent user={user} />
    </aside>
  )
}
