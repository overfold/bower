'use client'

import { useEffect, useRef, useState } from 'react'
import { getAllocationLogsAction } from '@/lib/actions/allocation-actions'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatLogTimestamp, timestampTitle } from '@/lib/format'

export function AllocationLogs({ serviceId, allocationId, tasks }: { serviceId: string; allocationId: string; tasks: { name: string; output: string; error: string | null }[] }) {
  const [task, setTask] = useState(tasks[0]?.name ?? '')
  const initial = tasks.find((entry) => entry.name === task)
  const [output, setOutput] = useState(initial?.output ?? '')
  const [error, setError] = useState(initial?.error ?? null)
  const [follow, setFollow] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [query, setQuery] = useState('')
  const container = useRef<HTMLPreElement>(null)
  // Server render and first paint use UTC; the viewer's own time zone applies after mount, as in Time.
  const [localTime, setLocalTime] = useState(false)
  useEffect(() => { const frame = requestAnimationFrame(() => setLocalTime(true)); return () => cancelAnimationFrame(frame) }, [])
  const { toast } = useFeedback()

  useEffect(() => {
    if (!follow || !task) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const next = await getAllocationLogsAction(serviceId, allocationId, task)
        if (!cancelled) { setOutput(next); setError(null) }
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Logs unavailable.')
      } finally { if (!cancelled) timer = setTimeout(refresh, 3000) }
    }
    void refresh()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [serviceId, allocationId, task, follow])
  useEffect(() => { if (follow && container.current) container.current.scrollTop = container.current.scrollHeight }, [output, follow])

  const lines = output.split('\n').filter((line) => !query || line.toLowerCase().includes(query.toLowerCase()))
  const needle = query.toLowerCase()
  // Copy and Download use exactly what the filter shows, with the raw (UTC) timestamps intact.
  const exported = query ? lines.join('\n') : output
  const matches = needle ? lines.reduce((count, line) => count + line.toLowerCase().split(needle).length - 1, 0) : 0
  function highlight(text: string) {
    if (!needle) return text
    const fragments: React.ReactNode[] = []
    let start = 0
    let index = text.toLowerCase().indexOf(needle)
    while (index !== -1) {
      fragments.push(text.slice(start, index), <mark key={index} className="rounded-sm bg-brand-100 text-ink">{text.slice(index, index + query.length)}</mark>)
      start = index + query.length
      index = text.toLowerCase().indexOf(needle, start)
    }
    fragments.push(text.slice(start))
    return fragments
  }
  return <Panel className="overflow-visible">
    <PanelHeader title="Task logs" />
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-surface p-3">
      <label className="flex items-center gap-2 text-sm">Task <Select value={task} onValueChange={(value) => {
        const next = tasks.find((entry) => entry.name === value)
        setTask(value); setOutput(next?.output ?? ''); setError(next?.error ?? null)
      }}><SelectTrigger aria-label="Log task" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{tasks.map((entry) => <SelectItem key={entry.name} value={entry.name}>{entry.name}</SelectItem>)}</SelectContent></Select></label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={follow} onCheckedChange={setFollow} />Follow</label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={wrap} onCheckedChange={setWrap} />Wrap</label>
      <SearchInput aria-label="Search logs" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query ? <span role="status" className="text-xs text-ink-muted">{matches} {matches === 1 ? 'match' : 'matches'}</span> : null}
      <Button size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(exported); toast({ tone: 'success', title: query ? 'Matching lines copied' : 'Logs copied' }) }
        catch { toast({ tone: 'danger', title: 'Could not copy logs' }) }
      }}>{query ? 'Copy matching lines' : 'Copy'}</Button>
      <Button size="sm" onClick={() => {
        const url = URL.createObjectURL(new Blob([exported], { type: 'text/plain' }))
        const link = document.createElement('a'); link.href = url; link.download = `${task}-${query ? 'matching-' : ''}logs.txt`; link.click(); URL.revokeObjectURL(url)
      }}>{query ? 'Download matching lines' : 'Download'}</Button>
    </div>
    {error ? <InlineNotice tone="danger" className="m-3">{error}</InlineNotice> : null}
    <pre ref={container} className={`h-[calc(100dvh-12rem)] min-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-ink-soft ${wrap ? 'whitespace-pre-wrap break-all' : ''}`}>{output ? lines.length ? lines.map((line, index) => {
      const timestamp = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/)
      const level = /\bERROR\b/i.test(line) ? 'text-danger-500' : /\bWARN(?:ING)?\b/i.test(line) ? 'text-warn-500' : ''
      return <span key={index} className={`block ${level}`}>{timestamp ? <><span className="text-ink-muted" title={timestampTitle(timestamp[1])}>{formatLogTimestamp(timestamp[1], localTime ? undefined : 'UTC') ?? highlight(timestamp[1])} </span>{highlight(timestamp[2])}</> : highlight(line || '\u00a0')}</span>
    }) : 'No matching log lines.' : 'No output'}</pre>
  </Panel>
}
