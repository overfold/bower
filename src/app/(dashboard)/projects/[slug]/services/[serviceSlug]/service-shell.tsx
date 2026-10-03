'use client'

import { usePathname } from 'next/navigation'

export function ServiceShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const allocation = pathname.includes('/allocations/')
  return <div className="space-y-6">{allocation ? null : header}{children}</div>
}
