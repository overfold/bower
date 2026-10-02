export default function ServiceLoading() {
  return <div aria-label="Loading service" aria-busy="true" className="animate-pulse space-y-6">
    {[0, 1].map((section) => <div key={section} className="space-y-4"><div className="h-5 w-40 rounded bg-line" /><div className="overflow-hidden rounded-xl border border-line bg-surface"><div className="h-11 border-b border-line bg-sunken" />{[0, 1, 2].map((row) => <div key={row} className="grid h-14 grid-cols-4 gap-5 border-b border-line px-4 py-4 last:border-0"><div className="rounded bg-line" /><div className="rounded bg-line" /><div className="rounded bg-line" /><div className="rounded bg-line" /></div>)}</div></div>)}
  </div>
}
