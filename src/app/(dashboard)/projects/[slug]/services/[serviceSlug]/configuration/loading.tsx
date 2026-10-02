export default function ConfigurationLoading() {
  return <div aria-label="Loading configuration" aria-busy="true" className="animate-pulse space-y-6"><div className="h-5 w-36 rounded bg-line" /><div className="rounded-xl border border-line bg-surface p-5"><div className="grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3].map((field) => <div key={field} className="space-y-2"><div className="h-3 w-24 rounded bg-line" /><div className="h-10 rounded-lg bg-line" /></div>)}</div><div className="mt-6 h-10 w-28 rounded-lg bg-line" /></div></div>
}
