import { cn } from '@/lib/utils'

interface PageHeadingProps {
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}

export function PageHeading({ title, description, actions, meta, className }: PageHeadingProps) {
  return (
    <header className={cn('flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8', className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="break-words text-[24px] font-bold leading-tight tracking-tightest text-ink sm:text-[26px]">{title}</h1>
        {description ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{description}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div> : null}
    </header>
  )
}

export function MetaItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
      {icon ? <span className="text-ink-faint">{icon}</span> : null}
      <span className="text-ink-muted">{label}</span>
      <span className="min-w-0 break-words font-medium text-ink">{value}</span>
    </div>
  )
}
