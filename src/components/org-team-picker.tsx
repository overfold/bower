'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Building2, ChevronsUpDown, Check, Users } from 'lucide-react'
import { switchOrgAction } from '@/lib/auth-actions'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OrgEntry {
  id: string
  name: string
  slug: string
  role: string
}

interface TeamEntry {
  id: string
  name: string
}

interface OrgTeamPickerProps {
  orgs: OrgEntry[]
  currentOrg: OrgEntry
  teams: TeamEntry[]
}

export function OrgTeamPicker({ orgs, currentOrg, teams }: OrgTeamPickerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleOrgSwitch(orgId: string) {
    if (orgId === currentOrg.id) return
    setOpen(false)
    startTransition(async () => {
      await switchOrgAction(orgId)
      router.refresh()
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-2 text-left text-[13px] font-medium text-ink transition-colors sm:py-1',
          'hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
          isPending && 'opacity-60',
        )}
        disabled={isPending}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <span className="max-w-[120px] truncate sm:max-w-[160px]">{currentOrg.name}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-ink-faint" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[220px]" sideOffset={6}>
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleOrgSwitch(org.id)}
            className="gap-2"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrg.id && (
              <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            )}
          </DropdownMenuItem>
        ))}

        {teams.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your teams</DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuItem key={team.id} className="gap-2" disabled>
                <Users className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                <span className="flex-1 truncate">{team.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
