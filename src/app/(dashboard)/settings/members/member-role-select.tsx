'use client'

import { useRef, useState, useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateOrganizationMemberRoleAction } from '@/lib/actions/settings'
import { organizationRoleLabels } from '@/lib/labels'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/feedback'

export function MemberRoleSelect({ membershipId, role, canManage, disabledReason }: {
  membershipId: string
  role: 'owner' | 'admin' | 'member'
  canManage: boolean
  disabledReason?: string
}) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(role)
  const [error, setError] = useState<string | null>(null)
  const roleRef = useRef<HTMLButtonElement>(null)
  if (!canManage) return null

  return (
    <div className="flex flex-wrap items-center gap-2"><TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-block" tabIndex={disabledReason ? 0 : undefined}>
    <Select
      value={value}
      disabled={pending || Boolean(disabledReason)}
      onValueChange={(next) => { setValue(next as typeof value); setError(null) }}
    >
      <SelectTrigger ref={roleRef} aria-label="Organization role" aria-invalid={Boolean(error)} aria-describedby={error ? `role-error-${membershipId}` : undefined} className="w-[112px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">{organizationRoleLabels.owner}</SelectItem>
        <SelectItem value="admin">{organizationRoleLabels.admin}</SelectItem>
        <SelectItem value="member">{organizationRoleLabels.member}</SelectItem>
      </SelectContent>
    </Select>
    </span></TooltipTrigger>{disabledReason ? <TooltipContent>{disabledReason}</TooltipContent> : null}</Tooltip></TooltipProvider>
    {!disabledReason ? <Button variant="primary" disabled={pending} loading={pending} onClick={() => { if (value === role) { setError('No changes to save.'); roleRef.current?.focus(); return }; startTransition(async () => { setError(null); const result = await updateOrganizationMemberRoleAction(membershipId, value); if (result.error) { setError(result.error); roleRef.current?.focus() } }) }}>Save</Button> : null}<div id={`role-error-${membershipId}`} className="basis-full"><FieldError>{error}</FieldError></div></div>
  )
}
