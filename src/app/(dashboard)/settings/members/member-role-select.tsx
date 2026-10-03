'use client'

import { useState, useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateOrganizationMemberRoleAction } from '@/lib/actions/settings'
import { organizationRoleLabels } from '@/lib/labels'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

export function MemberRoleSelect({ membershipId, role, canManage, disabledReason }: {
  membershipId: string
  role: 'owner' | 'admin' | 'member'
  canManage: boolean
  disabledReason?: string
}) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(role)
  if (!canManage) return null

  return (
    <div className="flex items-center gap-2"><TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-block" tabIndex={disabledReason ? 0 : undefined}>
    <Select
      value={value}
      disabled={pending || Boolean(disabledReason)}
      onValueChange={(next) => setValue(next as typeof value)}
    >
      <SelectTrigger aria-label="Organization role" className="w-[112px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">{organizationRoleLabels.owner}</SelectItem>
        <SelectItem value="admin">{organizationRoleLabels.admin}</SelectItem>
        <SelectItem value="member">{organizationRoleLabels.member}</SelectItem>
      </SelectContent>
    </Select>
    </span></TooltipTrigger>{disabledReason ? <TooltipContent>{disabledReason}</TooltipContent> : null}</Tooltip></TooltipProvider>
    {!disabledReason ? <Button size="sm" variant="primary" disabled={pending || value === role} loading={pending} onClick={() => startTransition(async () => { await updateOrganizationMemberRoleAction(membershipId, value) })}>Save</Button> : null}</div>
  )
}
