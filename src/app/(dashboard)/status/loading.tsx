import { HeadingSkeleton, TableSkeleton } from '@/components/page-skeletons'
import { Panel } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function StatusLoading() {
  return <div aria-label="Loading status" aria-busy="true" className="space-y-6"><HeadingSkeleton /><Panel><div className="grid items-center gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr]"><Skeleton className="h-8 w-20" /><Skeleton className="h-4 w-36" />{[0, 1].map((meter) => <div key={meter} className="space-y-2"><Skeleton className="h-3 w-48 max-w-full" /><Skeleton className="h-1.5" /></div>)}</div></Panel><TableSkeleton rows={3} columns={4} /><TableSkeleton rows={3} columns={5} /><TableSkeleton rows={4} columns={7} /><TableSkeleton rows={3} columns={4} /></div>
}
