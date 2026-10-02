'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

export function ProjectShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments()
  const deep = segments[0] === 'services' && segments.length > 1
    || segments[0] === 'deployments' && segments.length > 1

  return deep ? <div>{children}</div> : <div className="space-y-0">{header}<div className="pt-6">{children}</div></div>
}
