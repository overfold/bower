'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeading } from '@/components/page-heading'
import { ServiceTabs } from './service-tabs'

export function ServiceHeader({
  slug,
  serviceSlug,
  serviceName,
}: {
  slug: string
  serviceSlug: string
  serviceName: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${slug}/services`} className="text-ink-muted transition-colors hover:text-ink" aria-label="Back to services">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeading title={serviceName} />
      </div>
      <div className="border-b border-line">
        <ServiceTabs slug={slug} serviceSlug={serviceSlug} />
      </div>
    </div>
  )
}
