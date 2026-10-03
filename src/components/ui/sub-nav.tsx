import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface SubNavItem {
  label: string
  href: string
  active?: boolean
}

export function SubNav({ items, label, className }: { items: SubNavItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('space-y-0.5', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'block rounded-lg px-2.5 py-[7px] text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            item.active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-sunken hover:text-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
