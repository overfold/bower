'use client'

import { useRef, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { updateServiceAdvancedAction } from '@/lib/actions/service-settings'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'

export function AdvancedConfigForm({
  serviceId,
  environmentId,
  runtime: initialRuntime,
  apiAccessScope,
  apiAccessLevel,
  mayBypassMultitenancy,
}: {
  serviceId: string
  environmentId: string
  runtime: 'runc' | 'runsc'
  apiAccessScope: 'cluster' | null
  apiAccessLevel: 'read' | 'write' | null
  mayBypassMultitenancy: boolean
}) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [runtime, setRuntime] = useState(initialRuntime)
  const initialAccess = apiAccessScope && apiAccessLevel ? `${apiAccessScope}:${apiAccessLevel}` : 'none'
  const [apiAccess, setApiAccess] = useState(initialAccess)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const sensitive = apiAccess !== 'none'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(event.currentTarget)
      await updateServiceAdvancedAction(serviceId, environmentId, formData)
      setDirty(false)
      toast({ tone: 'success', title: 'Advanced settings saved.' })
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not update advanced settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} onChange={(event) => { if (!(event.target instanceof HTMLSelectElement)) setDirty(true) }} className="space-y-5 p-4" aria-busy={saving}>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`runtime-${environmentId}`}>Isolation</Label>
          <Select name="runtime" value={runtime} onValueChange={(value) => { setRuntime(value as 'runc' | 'runsc'); setDirty(true) }}>
            <SelectTrigger id={`runtime-${environmentId}`} aria-describedby={`runtime-help-${environmentId}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="runc">None</SelectItem>
              <SelectItem value="runsc">Sandboxed</SelectItem>
            </SelectContent>
          </Select>
          <p id={`runtime-help-${environmentId}`} className="text-2xs leading-relaxed text-ink-muted">
            Sandboxed workloads use stronger process isolation for the whole service.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`api-access-${environmentId}`}>Workload API access</Label>
          <Select name="apiAccess" value={apiAccess} onValueChange={(value) => { setApiAccess(value); setDirty(true) }}>
            <SelectTrigger id={`api-access-${environmentId}`} aria-describedby={`api-access-help-${environmentId}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {mayBypassMultitenancy && <>
                <SelectItem value="cluster:read">Cluster · read</SelectItem>
                <SelectItem value="cluster:write">Cluster · write</SelectItem>
              </>}
            </SelectContent>
          </Select>
          <p id={`api-access-help-${environmentId}`} className="text-2xs leading-relaxed text-ink-muted">
            Lets this service call the cluster API. Any access is cluster-wide, and only an instance admin can turn it on.
          </p>
        </div>
      </div>
      {sensitive && (
        <InlineNotice tone="warning" icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}>
          This service has cluster-wide workload API access. An instance admin must keep this access enabled to save or deploy it.
        </InlineNotice>
      )}
      <UnsavedChangesBar dirty={dirty} pending={saving} onSave={() => formRef.current?.requestSubmit()} onDiscard={() => { formRef.current?.reset(); setRuntime(initialRuntime); setApiAccess(initialAccess); setDirty(false); setError(null) }} />
    </form>
  )
}
