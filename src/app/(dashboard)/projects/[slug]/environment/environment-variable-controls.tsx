'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEnvironmentVariablesAction } from '@/lib/actions/environment-variables'
import { actionErrorMessage } from '@/lib/action-error'
import { KeyValueEditor } from '@/components/key-value-editor'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'

export function EnvironmentVariableControls({ projectId, environmentId, names }: { projectId: string; environmentId: string; names: string[] }) {
  const router = useRouter()
  const { toast } = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      await updateEnvironmentVariablesAction(projectId, environmentId, new FormData(event.currentTarget))
      setDirty(false)
      toast({ tone: 'success', title: 'Environment variables saved' }); router.refresh()
    } catch (cause) { setError(actionErrorMessage(cause, 'Could not save environment variables.')) }
    finally { setSaving(false) }
  }

  return <form ref={formRef} onSubmit={submit} className="space-y-4 p-4">
    {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
    <p className="text-xs text-ink-muted">Existing values are hidden. Leave their value blank to keep it unchanged.</p>
    <KeyValueEditor key={editorVersion} initialRows={names.map((key) => ({ key, value: '' }))} preserveBlankValues onChange={() => setDirty(true)} />
    <UnsavedChangesBar dirty={dirty} pending={saving} onSave={() => formRef.current?.requestSubmit()} onDiscard={() => { setEditorVersion((value) => value + 1); setDirty(false); setError(null) }} />
  </form>
}
