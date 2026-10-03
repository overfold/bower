import { TableSkeleton } from '@/components/page-skeletons'
import { Panel } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function ServiceLoading() {
  return <div aria-label="Loading service" aria-busy="true" className="space-y-6"><Skeleton className="h-6 w-24" /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((metric) => <Panel key={metric} className="space-y-3 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-40" /><Skeleton className="h-1.5" /><Skeleton className="h-3 w-48" /></Panel>)}</div>{[0, 1].map((section) => <div key={section} className="space-y-5"><Skeleton className="h-6 w-40" /><TableSkeleton rows={3} columns={5} /></div>)}</div>
}
