'use client'

import { ChevronDown } from 'lucide-react'
import { Fragment } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { label } from '@/lib/labels'

export function EventDetails({ details }: { details: Record<string, unknown> }) {
  return <Collapsible className="group mt-3">
    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-link">
      Details <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <dl className="mt-2 grid max-w-3xl grid-cols-[minmax(6rem,0.4fr)_minmax(0,1fr)] gap-x-4 gap-y-2 rounded bg-sunken p-3 text-xs">
        {Object.entries(details).map(([key, value]) => <Fragment key={key}><dt className="text-ink-muted">{label(key)}</dt><dd className="whitespace-pre-wrap break-words font-mono text-ink-soft">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd></Fragment>)}
      </dl>
    </CollapsibleContent>
  </Collapsible>
}
