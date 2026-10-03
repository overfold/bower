import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'

export function HeadingSkeleton() {
  return <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Panel>
      <PanelHeader><Skeleton className="h-4 w-36" /></PanelHeader>
      <div className="flex gap-5 border-b border-line bg-sunken px-4 py-3">
        {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className="h-3 min-w-0 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-5 border-b border-line px-4 py-3 last:border-0">
          {Array.from({ length: columns }, (_, column) => <div key={column} className="min-w-0 flex-1"><Skeleton className={column === 0 ? 'h-4 w-3/4' : 'h-4 w-1/2'} /></div>)}
        </div>
      ))}
    </Panel>
  )
}

export function TablePageSkeleton() {
  return <div aria-label="Loading table" aria-busy="true" className="space-y-6"><HeadingSkeleton /><TableSkeleton /></div>
}

export function FormSkeleton() {
  return (
    <div aria-label="Loading form" aria-busy="true" className="space-y-6">
      <HeadingSkeleton />
      <FormPanelSkeleton />
    </div>
  )
}

function FormPanelSkeleton() {
  return <Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader><div className="space-y-5 p-4">{[0, 1, 2].map((field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full max-w-lg rounded-lg" /></div>)}</div><div className="flex justify-end border-t border-line bg-sunken px-4 py-3"><Skeleton className="h-9 w-28 rounded-lg" /></div></Panel>
}

export function SettingsSkeleton() {
  return <div aria-label="Loading settings" aria-busy="true" className="space-y-6"><HeadingSkeleton /><FormPanelSkeleton /><FormPanelSkeleton /></div>
}

export function TeamSkeleton() {
  return <div aria-label="Loading team" aria-busy="true" className="space-y-6"><HeadingSkeleton /><TableSkeleton rows={4} columns={3} /><TableSkeleton rows={3} columns={2} /></div>
}

export function MemberSkeleton() {
  return <div aria-label="Loading member" aria-busy="true" className="space-y-6"><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 shrink-0 rounded-lg" /><div className="min-w-0"><HeadingSkeleton /></div></div><Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader><div className="grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2].map((field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-28" /></div>)}</div></Panel><Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader><div className="space-y-2 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-40 rounded-lg" /></div></Panel><Panel><PanelHeader><Skeleton className="h-4 w-16" /></PanelHeader>{[0, 1].map((team) => <div key={team} className="border-b border-line px-4 py-3 last:border-0"><Skeleton className="h-4 w-40" /></div>)}</Panel></div>
}

export function EnvironmentSkeleton() {
  return <div aria-label="Loading environment" aria-busy="true" className="space-y-6"><Skeleton className="h-6 w-32" /><div className="grid gap-5"><TableSkeleton columns={4} /><TableSkeleton rows={3} columns={3} /></div></div>
}

export function ProjectSettingsSkeleton() {
  return <div aria-label="Loading project settings" aria-busy="true" className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]"><div className="hidden space-y-4 lg:block">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-4 w-24" />)}</div><div className="min-w-0 space-y-10"><FormSkeleton />{[0, 1, 2].map((section) => <div key={section} className="space-y-6 border-t border-line pt-8"><Skeleton className="h-6 w-32" /><TableSkeleton rows={3} /></div>)}</div></div>
}

export function ServiceHeaderSkeleton() {
  return <div aria-label="Loading service header" aria-busy="true" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><HeadingSkeleton /><Skeleton className="h-9 w-32 rounded-lg" /></div><div className="flex gap-6 overflow-hidden border-b border-line px-3 py-3">{[0, 1, 2, 3].map((tab) => <Skeleton key={tab} className="h-4 w-24 shrink-0" />)}</div></div>
}

export function NodeSkeleton() {
  return <div aria-label="Loading node" aria-busy="true" className="space-y-6"><HeadingSkeleton /><Panel><PanelHeader><Skeleton className="h-4 w-32" /></PanelHeader><div className="grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-32" /></div>)}</div></Panel><Panel><PanelHeader><Skeleton className="h-4 w-24" /></PanelHeader><div className="grid gap-5 p-4 sm:grid-cols-2">{[0, 1].map((meter) => <div key={meter} className="space-y-3"><Skeleton className="h-4 w-48" /><Skeleton className="h-3" /><Skeleton className="h-3 w-40" /></div>)}</div></Panel><TableSkeleton columns={5} /></div>
}
