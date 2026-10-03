'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { updateMemberRolesAction } from '@/lib/actions/settings'

export function MemberRolesForm({ membershipId, memberName, organizationRole: initialOrganizationRole, instanceAdmin: initialInstanceAdmin, canManageOrganization, canManageInstance }: { membershipId: string; memberName: string; organizationRole: 'owner' | 'admin' | 'member'; instanceAdmin: boolean; canManageOrganization: boolean; canManageInstance: boolean }) {
  const [organizationRole, setOrganizationRole] = useState(initialOrganizationRole)
  const [instanceAdmin, setInstanceAdmin] = useState(initialInstanceAdmin)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setConfirming(false)
    startTransition(async () => {
      setError(null)
      const result = await updateMemberRolesAction({ membershipId, organizationRole, ...(canManageInstance ? { instanceAdmin } : {}) })
      if (result.error) setError(result.error)
    })
  }
  function requestSave() {
    if (canManageInstance && initialInstanceAdmin && !instanceAdmin) setConfirming(true)
    else save()
  }

  return <>
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <div className="space-y-2"><p className="text-xs font-medium text-ink-muted">Organization role</p><Select value={organizationRole} onValueChange={(value) => setOrganizationRole(value as typeof organizationRole)} disabled={!canManageOrganization || pending}><SelectTrigger aria-label="Organization role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="member">Member</SelectItem></SelectContent></Select></div>
      {canManageInstance ? <div className="space-y-2"><p className="text-xs font-medium text-ink-muted">Instance role</p><Select value={instanceAdmin ? 'admin' : 'user'} onValueChange={(value) => setInstanceAdmin(value === 'admin')} disabled={pending}><SelectTrigger aria-label="Instance role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="user">User</SelectItem></SelectContent></Select></div> : null}
      <div className="sm:col-span-2"><Button variant="primary" loading={pending} onClick={requestSave}>Save</Button><FieldError>{error}</FieldError></div>
    </div>
    <AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {memberName} as instance administrator?</AlertDialogTitle><AlertDialogDescription>This revokes instance-wide administrative access. Their organization membership is unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={save}>Remove instance admin and save</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
