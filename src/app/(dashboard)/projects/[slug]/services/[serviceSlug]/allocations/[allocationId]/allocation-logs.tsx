'use client'

import { useEffect, useRef, useState } from 'react'
import { getAllocationLogsAction } from '@/lib/actions/allocation-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Panel, PanelHeader } from '@/components/ui/panel'

export function AllocationLogs({ serviceId, allocationId, tasks }: { serviceId: string; allocationId: string; tasks: { name: string; output: string; error: string | null }[] }) {
  const [task, setTask] = useState(tasks[0]?.name ?? '')
  const initial = tasks.find((entry) => entry.name === task)
  const [output, setOutput] = useState(initial?.output ?? '')
  const [error, setError] = useState(initial?.error ?? null)
  const [follow, setFollow] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [query, setQuery] = useState('')
  const container = useRef<HTMLPreElement>(null)
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
  return <Panel>
    <PanelHeader title="Task logs" />
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <label className="flex items-center gap-2 text-sm">Task <select aria-label="Log task" value={task} className="rounded-lg border border-line bg-surface px-2 py-1.5" onChange={(event) => {
        const next = tasks.find((entry) => entry.name === event.target.value)
        setTask(event.target.value); setOutput(next?.output ?? ''); setError(next?.error ?? null)
      }}>{tasks.map((entry) => <option key={entry.name}>{entry.name}</option>)}</select></label>
      <Button size="sm" aria-pressed={follow} onClick={() => setFollow(!follow)}>Follow {follow ? 'on' : 'off'}</Button>
      <Button size="sm" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>Wrap {wrap ? 'on' : 'off'}</Button>
      <Input type="search" aria-label="Search logs" placeholder="Search logs…" className="w-48" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Button size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(output); toast({ tone: 'success', title: 'Logs copied' }) }
        catch { toast({ tone: 'danger', title: 'Could not copy logs' }) }
      }}>Copy</Button>
      <Button size="sm" onClick={() => {
        const url = URL.createObjectURL(new Blob([output], { type: 'text/plain' }))
        const link = document.createElement('a'); link.href = url; link.download = `${task}-logs.txt`; link.click(); URL.revokeObjectURL(url)
      }}>Download</Button>
    </div>
    {error ? <InlineNotice tone="danger" className="m-3">{error}</InlineNotice> : null}
    <pre ref={container} className={`max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-ink-soft ${wrap ? 'whitespace-pre-wrap break-all' : ''}`}>{output ? lines.length ? lines.map((line, index) => {
      const timestamp = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/)
      return <span key={index} className="block">{timestamp ? <><span className="text-ink-muted">{timestamp[1]} </span>{timestamp[2]}</> : line || '\u00a0'}</span>
    }) : 'No matching log lines.' : 'No output'}</pre>
  </Panel>
}
