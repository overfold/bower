'use client'

import { useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateOrganizationMemberRoleAction } from '@/lib/actions/settings'

export function MemberRoleSelect({ membershipId, role, canManage }: {
  membershipId: string
  role: 'owner' | 'admin' | 'member'
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()
  if (!canManage) return null

  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(value) => startTransition(async () => {
        await updateOrganizationMemberRoleAction(membershipId, value as 'owner' | 'admin' | 'member')
      })}
    >
      <SelectTrigger className="w-[112px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  )
}
