'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface TabItem {
  label: string
  href: string
  count?: number
}

export function ProjectTabs({ slug, tabs }: { slug: string; tabs: TabItem[] }) {
  const pathname = usePathname()
  const base = `/projects/${slug}`

  return (
    <nav className="flex items-center gap-1 overflow-x-auto overflow-y-hidden scroll-thin">
      {tabs.map((tab) => {
        const href = tab.href ? `${base}${tab.href}` : base
        const isActive =
          tab.href === ''
            ? pathname === base
            : pathname.startsWith(`${base}${tab.href}`)

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
              isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'nums rounded-md px-1.5 py-px text-2xs font-semibold',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'bg-sunken text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.span
                layoutId={`project-tabs-${slug}`}
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
