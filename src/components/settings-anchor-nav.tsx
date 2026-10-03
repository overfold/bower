'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function SettingsAnchorNav({ items }: { items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id)
    }, { rootMargin: '-20% 0px -65% 0px' })
    items.forEach(({ id }) => { const section = document.getElementById(id); if (section) observer.observe(section) })
    return () => observer.disconnect()
  }, [items])

  return <nav aria-label="Project settings" className="sticky top-20 space-y-1">
    {items.map((item) => <a key={item.id} href={`#${item.id}`} className={cn('block rounded-md px-3 py-2 text-sm', active === item.id ? 'bg-sunken font-medium text-ink' : 'text-ink-muted hover:text-ink')}>{item.label}</a>)}
  </nav>
}
