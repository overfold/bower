export default function ProjectLoading() {
  return <div aria-label="Loading project content" aria-busy="true" className="animate-pulse space-y-5"><div className="grid gap-5 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-xl border border-line bg-surface" />)}</div><div className="h-64 rounded-xl border border-line bg-surface" /></div>
}
