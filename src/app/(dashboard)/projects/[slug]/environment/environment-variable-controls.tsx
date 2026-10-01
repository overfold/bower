'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { deleteEnvironmentVariableAction, setEnvironmentVariableAction } from '@/lib/actions/environment-variables'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function CreateEnvironmentVariableDialog({
  projectId,
  environmentId,
}: {
  projectId: string
  environmentId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      await setEnvironmentVariableAction(projectId, environmentId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not save environment variable.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); if (next) setError(null) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add variable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add environment variable</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit}>
          <DialogBody className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
            <div className="space-y-2">
              <Label htmlFor="environmentVariableName">Name</Label>
              <Input
                id="environmentVariableName"
                name="name"
                placeholder="DATABASE_URL"
                required
                autoCapitalize="characters"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="environmentVariableValue">Value</Label>
              <Input
                id="environmentVariableValue"
                name="value"
                type="password"
                placeholder="Value"
                required
                className="font-mono"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save variable'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEnvironmentVariableButton({
  projectId,
  environmentId,
  name,
}: {
  projectId: string
  environmentId: string
  name: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(event: React.MouseEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await deleteEnvironmentVariableAction(projectId, environmentId, name)
      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(actionErrorMessage(cause, 'Could not delete environment variable.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" aria-label={`Delete ${name}`}><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete {name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the environment variable. Services that use it may fail on their next deployment.</AlertDialogDescription></AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={pending} aria-busy={pending}>{pending ? 'Deleting…' : 'Delete variable'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
