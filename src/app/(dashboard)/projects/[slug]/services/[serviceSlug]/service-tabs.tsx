'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const items = [
  { label: 'Overview', suffix: '' },
  { label: 'Volumes', suffix: '/volumes' },
  { label: 'Advanced', suffix: '/advanced' },
  { label: 'Revisions', suffix: '/revisions' },
]

export function ServiceTabs({ slug, serviceSlug }: { slug: string; serviceSlug: string }) {
  const pathname = usePathname()
  const base = `/projects/${slug}/services/${serviceSlug}`

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scroll-thin" aria-label="Service configuration">
      {items.map((item) => {
        const href = `${base}${item.suffix}`
        const isActive = item.suffix === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={item.label}
            href={href}
            className={cn(
              'relative flex items-center whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
              isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
            {isActive && (
              <motion.span
                layoutId={`service-tabs-${slug}-${serviceSlug}`}
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
