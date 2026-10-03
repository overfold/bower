import { HeadingSkeleton } from '@/components/page-skeletons'
import { Panel } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function AllocationLoading() {
  return <div aria-label="Loading allocation" aria-busy="true" className="space-y-6"><HeadingSkeleton /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((metric) => <Panel key={metric} className="space-y-3 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-40" /><Skeleton className="h-1.5" /><Skeleton className="h-3 w-48" /></Panel>)}</div><div className="flex gap-6 border-b border-line py-3">{[0, 1, 2].map((tab) => <Skeleton key={tab} className="h-4 w-16" />)}</div><Skeleton className="h-6 w-20" /><Panel className="p-4"><Skeleton className="h-64" /></Panel></div>
}
