'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { deleteSecretAction } from '@/lib/actions/operations'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { InlineNotice } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function SecretActions({
  projectId,
  secretId,
  secretName,
}: {
  projectId: string
  secretId: string
  secretName: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(event: React.MouseEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await deleteSecretAction(projectId, secretId)
      setOpen(false)
    } catch (cause) {
      setError(actionErrorMessage(cause, 'Could not delete secret.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <RowActions name={secretName}><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" onSelect={() => setOpen(true)}>Delete</RowActionItem></RowActions>
      <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete {secretName}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the secret <span className="font-mono text-ink">{secretName}</span> from the project environment. Services that depend on it may stop working.</AlertDialogDescription></AlertDialogHeader>
        {error ? <InlineNotice tone="danger" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={pending} aria-busy={pending}>{pending ? 'Deleting…' : 'Delete secret'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
