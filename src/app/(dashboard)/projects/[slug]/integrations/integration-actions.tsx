'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createWebhookAction, deleteWebhookAction,
  createNotificationChannelAction, deleteNotificationChannelAction,
  type WebhookCreationState,
} from '@/lib/actions/integrations'

interface CreateWebhookDialogProps {
  projectId: string
  services: { id: string; name: string }[]
  environments: { id: string; name: string }[]
}

export function CreateWebhookDialog({ projectId, services, environments }: CreateWebhookDialogProps) {
  const [open, setOpen] = useState(false)
  const boundAction = createWebhookAction.bind(null, projectId)
  const [state, formAction, isPending] = useActionState<WebhookCreationState, FormData>(boundAction, {})

  function handleClose() {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create webhook endpoint</DialogTitle>
        </DialogHeader>
        {state.token ? (
          <>
            <DialogBody>
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-ink">Copy this webhook token now. It will not be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-[12.5px] text-ink">
                    {state.token}
                  </code>
                  <Button variant="default" size="icon" onClick={() => navigator.clipboard.writeText(state.token!)} aria-label="Copy token">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" size="sm" onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <DialogBody className="space-y-4">
              {state.error ? <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{state.error}</div> : null}
              <div className="space-y-2">
                <Label htmlFor="wh-service">Service</Label>
                <Select name="serviceId">
                  <SelectTrigger id="wh-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-env">Environment</Label>
                <Select name="environmentId">
                  <SelectTrigger id="wh-env"><SelectValue placeholder="Select environment" /></SelectTrigger>
                  <SelectContent>
                    {environments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-provider">Provider</Label>
                <Select name="provider" defaultValue="generic">
                  <SelectTrigger id="wh-provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic</SelectItem>
                    <SelectItem value="docker_hub">Docker Hub</SelectItem>
                    <SelectItem value="ghcr">GHCR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-mode">Deploy mode</Label>
                <Select name="deployMode" defaultValue="any_push">
                  <SelectTrigger id="wh-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_push">Any push</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="digest">Digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-tag">Tag filter <span className="font-normal text-ink-muted">(optional regex)</span></Label>
                <Input id="wh-tag" name="tagFilter" placeholder="e.g. ^v\\d+\\.\\d+\\.\\d+$" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button variant="primary" type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create webhook'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function DeleteWebhookButton({ projectId, hookId, serviceName }: {
  projectId: string; hookId: string; serviceName: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Delete webhook for ${serviceName}`}>
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the webhook endpoint for {serviceName}. Incoming deploy triggers will stop working.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => startTransition(() => deleteWebhookAction(projectId, hookId))}
            className="bg-danger-500 text-white hover:bg-danger-500/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function CreateNotificationDialog({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createNotificationChannelAction(projectId, formData)
        handleClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create channel.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add channel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add notification channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error ? <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div> : null}
            <div className="space-y-2">
              <Label htmlFor="nc-name">Name</Label>
              <Input id="nc-name" name="name" placeholder="e.g. Slack deploys" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-type">Type</Label>
              <Select name="type" defaultValue="http">
                <SelectTrigger id="nc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-url">Endpoint URL</Label>
              <Input id="nc-url" name="url" type="url" placeholder="https://hooks.slack.com/..." required />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button variant="primary" type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Creating…' : 'Add channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteNotificationButton({ projectId, channelId, channelName }: {
  projectId: string; channelId: string; channelName: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Delete ${channelName}`}>
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {channelName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This notification channel will be permanently removed. Deployment notifications will stop being sent to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => startTransition(() => deleteNotificationChannelAction(projectId, channelId))}
            className="bg-danger-500 text-white hover:bg-danger-500/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
