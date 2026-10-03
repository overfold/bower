import { TableSkeleton } from '@/components/page-skeletons'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectLoading() {
  return <div aria-label="Loading project content" aria-busy="true" className="space-y-5"><Skeleton className="h-6 w-24" /><Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader><div className="grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((service) => <div key={service} className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-24" /></div>)}</div></Panel><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"><TableSkeleton /><TableSkeleton rows={3} columns={2} /></div></div>
}
