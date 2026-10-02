'use client'

import { useState, useTransition, useActionState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check } from 'lucide-react'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createWebhookAction, deleteWebhookAction,
  createNotificationChannelAction, deleteNotificationChannelAction,
  type WebhookCreationState,
} from '@/lib/actions/integrations'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'

interface CreateWebhookDialogProps {
  projectId: string
  services: { id: string; name: string }[]
  environmentId: string
}

export function CreateWebhookDialog({ projectId, services, environmentId }: CreateWebhookDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useFeedback()
  const boundAction = createWebhookAction.bind(null, projectId)
  const [state, formAction, isPending] = useActionState<WebhookCreationState, FormData>(boundAction, {})
  const [hideStaleError, setHideStaleError] = useState(false)
  const [copied, setCopied] = useState<Set<string>>(new Set())
  const endpointPath = `/api/webhooks/${state.token ?? ''}`
  const endpoint = typeof window === 'undefined' ? endpointPath : `${window.location.origin}${endpointPath}`

  function handleClose() {
    setOpen(false)
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied((current) => new Set(current).add(key))
      window.setTimeout(() => setCopied((current) => { const next = new Set(current); next.delete(key); return next }), 2000)
    } catch {
      toast({ tone: 'error', title: 'Could not copy value.' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isPending) return; if (!v) handleClose(); else { setHideStaleError(true); setOpen(true) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.token ? 'Webhook created' : 'Create webhook endpoint'}</DialogTitle>
        </DialogHeader>
        {state.token ? (
          <>
            <DialogBody>
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Copy this webhook token now. It will not be shown again.</p>
                {[['Endpoint URL', endpoint, 'url'], ['Token', state.token, 'token']].map(([label, value, key]) => <div key={key} className="space-y-1"><p className="text-xs font-medium text-ink-muted">{label}</p><div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-sm text-ink">
                    {value}
                  </code>
                  <Button variant="default" size="sm" onClick={() => copy(value, key)}>
                    {copied.has(key) ? <><Check />Copied</> : <><Copy />Copy</>}
                  </Button>
                </div></div>)}
                <div className="rounded-lg bg-sunken p-3 font-mono text-xs text-ink-soft">curl -X POST &apos;{endpoint}&apos; -H &apos;Authorization: Bearer {'<token>'}&apos;</div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" size="sm" onClick={handleClose} disabled={!copied.has('token')}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form action={formAction} onSubmit={() => setHideStaleError(false)}>
            <DialogBody className="space-y-4">
              {state.error && !hideStaleError ? <InlineNotice tone="error">{state.error}</InlineNotice> : null}
              <input type="hidden" name="environmentId" value={environmentId} />
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
                <Label htmlFor="wh-tag" optional>Tag filter</Label>
                <Input id="wh-tag" name="tagFilter" placeholder="e.g. ^v\\d+\\.\\d+\\.\\d+$" mono />
                <p className="text-xs text-ink-muted">Regular expression matched against image tags.</p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button variant="primary" type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
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
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function remove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await deleteWebhookAction(projectId, hookId)
        setOpen(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not delete webhook.'))
      }
    })
  }

  return (
    <>
      <RowActions name={`webhook for ${serviceName}`}><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={isPending} onSelect={() => setOpen(true)}>Delete</RowActionItem></RowActions>
      <AlertDialog open={open} onOpenChange={(next) => { if (!isPending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete webhook for {serviceName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the webhook endpoint for {serviceName}. Incoming deploy triggers will stop working.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            aria-busy={isPending}
            onClick={remove}
          >
            {isPending ? 'Deleting…' : 'Delete webhook'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
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
        setError(actionErrorMessage(err, 'Failed to create channel.'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isPending) return; if (!v) handleClose(); else { setError(null); setOpen(true) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add channel
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add notification channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
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
              <Input id="nc-url" name="url" type="url" placeholder="https://hooks.slack.com/..." required mono />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button variant="primary" type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
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
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function remove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await deleteNotificationChannelAction(projectId, channelId)
        setOpen(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not delete notification channel.'))
      }
    })
  }

  return (
    <>
      <RowActions name={channelName}><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={isPending} onSelect={() => setOpen(true)}>Delete</RowActionItem></RowActions>
      <AlertDialog open={open} onOpenChange={(next) => { if (!isPending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {channelName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This notification channel will be permanently removed. Deployment notifications will stop being sent to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            aria-busy={isPending}
            onClick={remove}
          >
            {isPending ? 'Deleting…' : 'Delete channel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
