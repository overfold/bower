'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const orgTabs = [
  { label: 'Organization', href: '/settings/organization' },
  { label: 'Members', href: '/settings/members' },
  { label: 'Teams', href: '/settings/teams' },
  { label: 'Cluster', href: '/settings/cluster' },
]

export function SettingsNav({ showInstance }: { showInstance: boolean }) {
  const pathname = usePathname()
  const tabs = showInstance
    ? [...orgTabs, { label: 'Instance', href: '/settings/instance' }]
    : orgTabs

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-line scroll-thin" aria-label="Settings">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink'
            )}
          >
            {tab.label}
            {active && (
              <motion.span
                layoutId="settings-nav-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500"
                transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
