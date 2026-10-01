'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { deleteSecretAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

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
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" aria-label={`Delete ${secretName}`}><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete {secretName}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the secret <span className="font-mono text-ink">{secretName}</span> from the project environment. Services that depend on it may stop working.</AlertDialogDescription></AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={pending} aria-busy={pending}>{pending ? 'Deleting…' : 'Delete secret'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
