import { cn } from '@/lib/utils'
import { toneDotClasses, type Tone } from '@/lib/tone'

export type TimelineItem = { id: string; title: React.ReactNode; titleTooltip?: string; description?: React.ReactNode; time?: React.ReactNode; tone?: Tone }

export function Timeline({ items }: { items: TimelineItem[] }) {
  return <ol className="px-4 py-2">{items.map((item, index) => <li key={item.id} className="relative flex gap-4 py-3.5">
    {index < items.length - 1 && <span className="absolute left-[7px] top-7 h-[calc(100%-0.5rem)] w-px bg-line" aria-hidden="true" />}
    <span className={cn('relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-surface ring-1 ring-line-strong', toneDotClasses[item.tone ?? 'neutral'])} aria-hidden="true" />
    <div className="min-w-0 flex-1"><div className="text-sm font-medium text-ink" title={item.titleTooltip}>{item.title}</div>{item.description ? <div className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.description}</div> : null}</div>
    {item.time ? <div className="shrink-0 text-2xs text-ink-muted">{item.time}</div> : null}
  </li>)}</ol>
}
