import { TableSkeleton } from '@/components/page-skeletons'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return <div aria-label="Loading dashboard" aria-busy="true" className="min-w-0 space-y-7">
    <Skeleton className="h-7 w-24" />
    <Panel><div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(300px,1.7fr)]">{[0, 1, 2, 3].map((stat) => <div key={stat} className="min-w-0 space-y-3 bg-surface px-4 py-4 sm:px-5"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-20" />{stat === 3 ? <Skeleton className="h-12" /> : <><Skeleton className="h-1.5" /><Skeleton className="h-3 w-32" /></>}</div>)}</div></Panel>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <TableSkeleton columns={4} />
      <div className="min-w-0 space-y-5">
        <Panel><PanelHeader><Skeleton className="h-4 w-24" /></PanelHeader>{[0, 1, 2].map((node) => <div key={node} className="flex justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-16" /></div>)}</Panel>
        <Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader>{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex gap-2.5 border-b border-line px-4 py-3 last:border-0"><Skeleton className="h-6 w-6 shrink-0 rounded-md" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /></div></div>)}</Panel>
      </div>
    </div>
  </div>
}
