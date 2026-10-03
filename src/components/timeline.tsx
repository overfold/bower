import { cn } from '@/lib/utils'

export type TimelineItem = { id: string; title: React.ReactNode; description?: React.ReactNode; time?: React.ReactNode; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }

export function Timeline({ items }: { items: TimelineItem[] }) {
  const tones = { neutral: 'bg-ink-faint', info: 'bg-info-500', success: 'bg-ok-500', warning: 'bg-warn-500', danger: 'bg-danger-500' }
  return <ol className="px-4 py-2">{items.map((item, index) => <li key={item.id} className="relative flex gap-4 py-3.5">
    {index < items.length - 1 && <span className="absolute left-[7px] top-7 h-[calc(100%-0.5rem)] w-px bg-line" aria-hidden="true" />}
    <span className={cn('relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-surface ring-1 ring-line-strong', tones[item.tone ?? 'neutral'])} aria-hidden="true" />
    <div className="min-w-0 flex-1"><div className="font-medium text-ink">{item.title}</div>{item.description ? <div className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.description}</div> : null}</div>
    {item.time ? <div className="shrink-0 text-2xs text-ink-muted">{item.time}</div> : null}
  </li>)}</ol>
}
