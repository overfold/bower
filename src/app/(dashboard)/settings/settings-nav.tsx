'use client'

import { usePathname } from 'next/navigation'
import { SubNav } from '@/components/ui/sub-nav'

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
    <div className="space-y-5">
      {navGroups.map((group) => <div key={group.label}>
        <p className="overline mb-1 px-2">{group.label}</p>
        <SubNav label={`${group.label} settings`} items={group.links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/')
          return { ...link, active }
        })} />
      </div>)}
    </div>
  )
}
