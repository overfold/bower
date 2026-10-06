'use client'

import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function LastDeployFailed({ href, outcome = 'failed' }: { href: string; outcome?: 'failed' | 'rolled_back' }) {
  const text = outcome === 'rolled_back' ? 'Last deploy rolled back' : 'Last deploy failed'
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Link href={href} aria-label={`${text} — view diagnostics`} className="relative z-10 rounded-md p-1 text-warn-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><TriangleAlert className="size-3.5" /></Link></TooltipTrigger><TooltipContent>{text} · View diagnostics</TooltipContent></Tooltip></TooltipProvider>
}
