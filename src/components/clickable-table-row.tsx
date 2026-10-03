'use client'

import { TableRow } from '@/components/ui/table'

export function ClickableTableRow({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const open = () => window.location.assign(href)
  return <TableRow interactive tabIndex={0} role="link" aria-label={label} onClick={(event) => {
    if (!(event.target as HTMLElement).closest('a,button,input,select,textarea,[role="menuitem"]')) open()
  }} onKeyDown={(event) => {
    if (event.target === event.currentTarget && event.key === 'Enter') open()
  }} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">{children}</TableRow>
}
