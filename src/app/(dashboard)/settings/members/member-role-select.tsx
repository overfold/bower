'use client'

import { useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateOrganizationMemberRoleAction } from '@/lib/actions/settings'
import { organizationRoleLabels } from '@/lib/labels'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function MemberRoleSelect({ membershipId, role, canManage, disabledReason }: {
  membershipId: string
  role: 'owner' | 'admin' | 'member'
  canManage: boolean
  disabledReason?: string
}) {
  const [pending, startTransition] = useTransition()
  if (!canManage) return null

  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={disabledReason ? 0 : undefined}>
    <Select
      value={role}
      disabled={pending || Boolean(disabledReason)}
      onValueChange={(value) => startTransition(async () => {
        await updateOrganizationMemberRoleAction(membershipId, value as 'owner' | 'admin' | 'member')
      })}
    >
      <SelectTrigger aria-label="Organization role" className="w-[112px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">{organizationRoleLabels.owner}</SelectItem>
        <SelectItem value="admin">{organizationRoleLabels.admin}</SelectItem>
        <SelectItem value="member">{organizationRoleLabels.member}</SelectItem>
      </SelectContent>
    </Select>
    </span></TooltipTrigger>{disabledReason ? <TooltipContent>{disabledReason}</TooltipContent> : null}</Tooltip></TooltipProvider>
  )
}
