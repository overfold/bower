export default function Loading() {
  return <div aria-label="Loading page" aria-busy="true" className="animate-pulse space-y-6"><div className="space-y-2"><div className="h-7 w-48 rounded bg-line" /><div className="h-4 w-80 max-w-full rounded bg-line" /></div><div className="grid gap-5 sm:grid-cols-2"><div className="h-32 rounded-xl border border-line bg-surface" /><div className="h-32 rounded-xl border border-line bg-surface" /></div><div className="h-72 rounded-xl border border-line bg-surface" /></div>
}
