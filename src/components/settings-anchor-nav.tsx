'use client'

import { useEffect, useState } from 'react'
import { SubNav } from '@/components/ui/sub-nav'

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

  return <SubNav className="sticky top-20" label="Project settings" items={items.map((item) => ({ label: item.label, href: `#${item.id}`, active: active === item.id }))} />
}
