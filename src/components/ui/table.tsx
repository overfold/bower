'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { minWidth?: 'md' }>(
  ({ className, minWidth, ...props }, ref) => {
    const wrapper = React.useRef<HTMLDivElement>(null)
    const titleId = React.useId()
    const explicitLabel = props['aria-labelledby']
    const [overflowing, setOverflowing] = React.useState(false)
    const [labelledBy, setLabelledBy] = React.useState<string | undefined>(explicitLabel)
    React.useEffect(() => {
      const element = wrapper.current!
      const table = element.querySelector('table')!
      const title = element.closest('[data-slot="card"]')?.querySelector('h1, h2, h3') ?? table.querySelector('caption')
      const update = () => {
        setOverflowing(element.scrollWidth > element.clientWidth)
        if (title && !title.id) title.id = titleId
        setLabelledBy(explicitLabel ?? title?.id)
      }
      const observer = new ResizeObserver(update)
      observer.observe(element)
      observer.observe(table)
      return () => observer.disconnect()
    }, [titleId, explicitLabel])
    return <div ref={wrapper} className="w-full overflow-x-auto scroll-thin scroll-horizontal [--scroll-surface:var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500" tabIndex={overflowing ? 0 : undefined} role={overflowing ? 'region' : undefined} aria-labelledby={overflowing ? labelledBy : undefined}>
      <table ref={ref} className={cn('w-full border-collapse text-left', minWidth === 'md' && 'min-w-[640px]', className)} {...props} />
    </div>
  },
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn(className)} {...props} />,
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />,
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tfoot ref={ref} className={cn('border-t border-line bg-sunken font-medium [&>tr]:last:border-b-0', className)} {...props} />,
)
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }>(
  ({ className, interactive, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-line last:[&>td]:border-b-0 transition-colors duration-150 ease-enter', interactive && 'cursor-pointer hover:bg-sunken', className)} {...props} />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} scope="col" className={cn('border-b border-line bg-sunken px-4 py-2 text-left align-middle text-2xs font-semibold uppercase tracking-wide text-ink-muted [&:has([role=checkbox])]:pr-0', className)} {...props} />
  ),
)
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("border-b border-line px-4 py-3 align-middle text-sm text-ink-soft [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
)
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cn('mt-4 text-sm text-ink-muted', className)} {...props} />,
)
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
