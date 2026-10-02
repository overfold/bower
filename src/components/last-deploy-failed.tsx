'use client'

import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function LastDeployFailed({ href }: { href: string }) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Link href={href} aria-label="Last deploy failed — view diagnostics" className="relative z-10 rounded-md p-1 text-warn-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><TriangleAlert className="size-3.5" /></Link></TooltipTrigger><TooltipContent>Last deploy failed · View diagnostics</TooltipContent></Tooltip></TooltipProvider>
}
