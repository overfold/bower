'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const groups = [
  { label: 'Personal', links: [{ label: 'Account', href: '/settings/account' }] },
  { label: 'Organization', links: [
    { label: 'Organization', href: '/settings/organization' }, { label: 'Members', href: '/settings/members' },
    { label: 'Teams', href: '/settings/teams' }, { label: 'Domains', href: '/settings/domains' },
  ] },
]

export function SettingsNav({ showInstance }: { showInstance: boolean }) {
  const pathname = usePathname()
  const navGroups = showInstance
    ? [groups[0], { label: 'Instance', links: [{ label: 'Organizations', href: '/settings/instance' }] }, groups[1]]
    : groups
  return (
    <nav className="space-y-5" aria-label="Settings">
      {navGroups.map((group) => <div key={group.label}>
        <p className="overline mb-1 px-2">{group.label}</p>
        <div className="space-y-0.5">{group.links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/')
          return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={cn('block rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', active ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-muted hover:bg-sunken hover:text-ink')}>{link.label}</Link>
        })}</div>
      </div>)}
    </nav>
  )
}
