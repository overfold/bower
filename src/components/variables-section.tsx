'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react'
import { buildVariableMatrix, removeServiceVariable, setServiceBinding, setServiceValue, type VariableService } from '@/lib/variable-matrix'
import { deleteEnvironmentVariableAction, setEnvironmentVariableAction } from '@/lib/actions/environment-variables'
import { updateServiceEnvironmentOverridesAction } from '@/lib/actions/service-settings'
import { actionErrorMessage } from '@/lib/action-error'
import { parseEnvText } from '@/components/key-value-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatRelativeTime } from '@/lib/format'

export type VariablesSectionProps = {
  projectId: string
  environmentId: string
  sharedNames: string[]
  services: VariableService[]
  secretLabels: Record<string, string>
  canManage: boolean
  serviceId?: string
  updatedAt: string
  onServiceChange?: (service: VariableService) => void
}

function MaskedValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  return <div className="flex min-w-[130px] items-center gap-1" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setShown(false)
  }}>
    <button type="button" className="truncate rounded-lg px-1.5 py-1 font-mono text-xs hover:bg-sunken" onClick={() => setShown(true)} aria-label={shown ? 'Value revealed' : 'Reveal value'}>
      {shown ? value : '••••••••'}
    </button>
    {shown ? <Button type="button" variant="ghost" size="sm" aria-label="Copy value" onClick={async () => {
      await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200)
    }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button> : null}
  </div>
}

function InheritedUnavailableValue() {
  return <span className="text-xs text-ink-muted">↳ Shared</span>
}

function SharedUnavailableValue({ updatedAt }: { updatedAt: string }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-muted" title={`Write-only. Set ${formatRelativeTime(updatedAt)}.`}>••••••••<LockKeyhole className="h-3.5 w-3.5" /></span>
}

export function VariablesSection(props: VariablesSectionProps) {
  const services = props.serviceId ? props.services.filter((service) => service.id === props.serviceId) : props.services
  const rows = useMemo(() => buildVariableMatrix(props.sharedNames, services, props.secretLabels), [props.sharedNames, services, props.secretLabels])
  return <Panel>
    <PanelHeader title="Variables" hint={`${rows.length} ${rows.length === 1 ? 'variable' : 'variables'}`} action={props.canManage ? <div className="flex gap-2"><PasteDialog {...props} services={services} /><VariableDialog {...props} services={services} /></div> : undefined} />
    {rows.length === 0 ? <div className="p-6 text-sm text-ink-muted">No variables configured.</div> : <Table minWidth="md">
      <TableHeader><TableRow><TableHead>Key</TableHead>{props.serviceId ? <><TableHead>Value</TableHead><TableHead>Source</TableHead></> : <><TableHead>Shared</TableHead>{services.map((service) => <TableHead key={service.id}>{service.name}</TableHead>)}</>}{props.canManage ? <TableHead><span className="sr-only">Actions</span></TableHead> : null}</TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.key}>
        <TableCell className="font-mono text-xs font-medium">{row.key}</TableCell>
        {!props.serviceId ? <TableCell>{row.shared === 'write-only' ? <SharedUnavailableValue updatedAt={props.updatedAt} /> : <span className="text-ink-muted">—</span>}</TableCell> : null}
        {row.services.map((cell, index) => <TableCell key={services[index].id}>{cell.kind === 'secret'
          ? <span className="inline-flex max-w-[240px] items-start gap-1.5" title={`${cell.displayName} · ${cell.target === 'file' ? `File: ${row.key}` : `Environment variable: ${row.key}`}`}><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="block truncate">{cell.displayName}</span><span className="block text-2xs text-ink-muted">{cell.target === 'file' ? `File · ${row.key}` : `Environment variable · ${row.key}`}</span></span></span>
          : cell.kind === 'value' ? <MaskedValue value={cell.value} />
          : cell.kind === 'inherited' ? <InheritedUnavailableValue />
          : <span className="text-ink-muted">—</span>}</TableCell>)}
        {props.serviceId ? <TableCell className="text-xs text-ink-muted">{row.services[0]?.kind === 'inherited' ? 'Shared' : 'This service'}</TableCell> : null}
        {props.canManage ? <TableCell className="w-12"><VariableDialog {...props} services={services} editKey={row.key} icon /></TableCell> : null}
      </TableRow>)}</TableBody>
    </Table>}
  </Panel>
}

function VariableDialog({ editKey, icon, ...props }: VariablesSectionProps & { editKey?: string; icon?: boolean }) {
  const router = useRouter(); const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{ id: string; message: string } | null>(null)
  const initialTarget = props.serviceId ?? (editKey && !props.sharedNames.includes(editKey)
    ? props.services.find((service) => service.envVars[editKey] !== undefined || service.secretBindings.some((binding) => binding.target === 'env' ? binding.env === editKey : binding.path === editKey))?.id ?? 'shared'
    : 'shared')
  const [target, setTarget] = useState(initialTarget)
  const [kind, setKind] = useState<'value' | 'secret'>('value')
  const [key, setKey] = useState(editKey ?? '')
  const [secretName, setSecretName] = useState(Object.keys(props.secretLabels)[0] ?? '')
  const [bindingTarget, setBindingTarget] = useState<'env' | 'file'>('env')
  const [destination, setDestination] = useState(editKey ?? '')

  function selectScope(next: string) {
    setTarget(next); setError(null); setFieldError(null); setKey(editKey ?? ''); setDestination(editKey ?? '')
    if (next === 'shared') { setKind('value'); return }
    const service = props.services.find((item) => item.id === next)
    const binding = service?.secretBindings.find((item) => item.target === 'env' ? item.env === editKey : item.path === editKey)
    if (binding) {
      setKind('secret'); setSecretName(binding.name); setBindingTarget(binding.target)
      setDestination((binding.target === 'env' ? binding.env : binding.path) ?? '')
    } else setKind('value')
  }

  function servicePayload(service: VariableService) {
    const payload = new FormData()
    payload.set('envVars', JSON.stringify(Object.entries(service.envVars).map(([key, value]) => ({ key, value }))))
    payload.set('secretBindings', JSON.stringify(service.secretBindings))
    return payload
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation(); setSaving(true); setError(null); setFieldError(null)
    const data = new FormData(event.currentTarget); const value = String(data.get('value') ?? '')
    try {
      if (target === 'shared') {
        data.set('name', key)
        await setEnvironmentVariableAction(props.projectId, props.environmentId, data)
      }
      else {
        const service = props.services.find((item) => item.id === target); if (!service) throw new Error('Service not found.')
        let updated: VariableService
        if (kind === 'secret') {
          if (!secretName) { const id = `variable-secret-${editKey ?? 'new'}`; setFieldError({ id, message: 'Select a secret.' }); requestAnimationFrame(() => document.getElementById(id)?.focus()); return }
          if (!destination) { const id = `binding-destination-${editKey ?? 'new'}`; setFieldError({ id, message: bindingTarget === 'env' ? 'Enter an environment variable.' : 'Enter a file path.' }); requestAnimationFrame(() => document.getElementById(id)?.focus()); return }
          updated = setServiceBinding(service, bindingTarget === 'env'
            ? { name: secretName, target: 'env', env: destination }
            : { name: secretName, target: 'file', path: destination }, editKey ?? destination)
        } else {
          const existingValue = editKey ? service.envVars[editKey] : undefined
          if (!value && existingValue === undefined) { const id = `variable-value-${editKey ?? 'new'}`; setFieldError({ id, message: 'A value is required.' }); requestAnimationFrame(() => document.getElementById(id)?.focus()); return }
          updated = setServiceValue(service, key, value || existingValue || '', editKey ?? key)
        }
        if (props.onServiceChange) props.onServiceChange(updated)
        else await updateServiceEnvironmentOverridesAction(service.id, props.environmentId, servicePayload(updated))
      }
      setOpen(false); if (!props.onServiceChange || target === 'shared') router.refresh()
    } catch (cause) { setError(actionErrorMessage(cause, 'Could not save variable.')); requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(':invalid')?.focus()) }
    finally { setSaving(false) }
  }
  async function remove() {
    if (!editKey) return
    setSaving(true); setError(null)
    try {
      if (target === 'shared') await deleteEnvironmentVariableAction(props.projectId, props.environmentId, editKey)
      else {
        const service = props.services.find((item) => item.id === target); if (!service) throw new Error('Service not found.')
        const updated = removeServiceVariable(service, editKey)
        if (props.onServiceChange) props.onServiceChange(updated)
        else await updateServiceEnvironmentOverridesAction(service.id, props.environmentId, servicePayload(updated))
      }
      setOpen(false); if (!props.onServiceChange || target === 'shared') router.refresh()
    } catch (cause) { setError(actionErrorMessage(cause, 'Could not remove variable.')) } finally { setSaving(false) }
  }
  const selectedService = props.services.find((service) => service.id === target)
  const hasSelectedOverride = Boolean(editKey && selectedService && (editKey in selectedService.envVars || selectedService.secretBindings.some((binding) => binding.target === 'env' ? binding.env === editKey : binding.path === editKey)))
  const canRemove = target === 'shared' ? Boolean(editKey && props.sharedNames.includes(editKey)) : hasSelectedOverride
  return <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); if (next) { setFieldError(null); selectScope(initialTarget) } } }}><DialogTrigger asChild>{icon
    ? <Button variant="ghost" size="sm" aria-label={`Edit ${editKey}`}><Pencil className="h-3.5 w-3.5" /></Button>
    : <Button variant="primary" size="sm"><Plus className="h-4 w-4" />New variable</Button>}</DialogTrigger>
    <DialogContent size={editKey ? 'lg' : 'md'}><DialogHeader><DialogTitle>{editKey ? `Edit ${editKey}` : 'Create variable'}</DialogTitle></DialogHeader>
      <form ref={formRef} onSubmit={submit} onInvalid={(event) => { event.preventDefault(); const field = event.target as HTMLInputElement; const message = field.validity.patternMismatch ? 'Use a key starting with a letter or underscore, followed by uppercase letters, numbers, or underscores.' : field.validationMessage; setFieldError({ id: field.id, message }); field.focus() }} onInput={(event) => { const field = event.target as HTMLInputElement; if (field.validity?.valid && fieldError?.id === field.id) setFieldError(null) }}><DialogBody className="space-y-4">{error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <div className="space-y-2"><Label>Scope</Label><Select value={target} onValueChange={selectScope}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!props.serviceId && (!editKey || /^[A-Z_][A-Z0-9_]*$/.test(editKey)) ? <SelectItem value="shared">Shared</SelectItem> : null}{props.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name} configuration</SelectItem>)}</SelectContent></Select></div>
        {target !== 'shared' ? <div className="space-y-2"><Label>Source</Label><Select value={kind} onValueChange={(value) => { setKind(value as 'value' | 'secret'); setFieldError(null) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="value">Plain value</SelectItem><SelectItem value="secret" disabled={Object.keys(props.secretLabels).length === 0}>Secret binding</SelectItem></SelectContent></Select></div> : null}
        {kind === 'secret' && target !== 'shared' ? <>
          <div className="space-y-2"><Label htmlFor={`variable-secret-${editKey ?? 'new'}`}>Secret</Label><Select value={secretName} onValueChange={(value) => { setSecretName(value); setFieldError(null) }}><SelectTrigger id={`variable-secret-${editKey ?? 'new'}`} aria-invalid={fieldError?.id === `variable-secret-${editKey ?? 'new'}`} aria-describedby={fieldError?.id === `variable-secret-${editKey ?? 'new'}` ? `variable-secret-error-${editKey ?? 'new'}` : undefined}><SelectValue placeholder="Select a secret" /></SelectTrigger><SelectContent>{Object.entries(props.secretLabels).map(([name, label]) => <SelectItem key={name} value={name}>{label}</SelectItem>)}</SelectContent></Select>{fieldError?.id === `variable-secret-${editKey ?? 'new'}` ? <p id={`variable-secret-error-${editKey ?? 'new'}`} className="text-xs text-danger-500">{fieldError.message}</p> : null}</div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]"><div className="space-y-2"><Label>Target</Label><Select value={bindingTarget} onValueChange={(value) => { const next = value as 'env' | 'file'; setBindingTarget(next); setDestination(next === 'env' ? (editKey && /^[A-Z_]/.test(editKey) ? editKey : secretName) : `/run/trellis-secrets/${secretName}`) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="env">Environment</SelectItem><SelectItem value="file">File</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor={`binding-destination-${editKey ?? 'new'}`}>{bindingTarget === 'env' ? 'Environment variable' : 'File path'}</Label><Input id={`binding-destination-${editKey ?? 'new'}`} value={destination} onChange={(event) => setDestination(event.target.value)} required pattern={bindingTarget === 'env' ? '[A-Z_][A-Z0-9_]*' : undefined} mono aria-invalid={fieldError?.id === `binding-destination-${editKey ?? 'new'}`} aria-describedby={`binding-destination-help-${editKey ?? 'new'}`} /><p id={`binding-destination-help-${editKey ?? 'new'}`} className={`text-xs ${fieldError?.id === `binding-destination-${editKey ?? 'new'}` ? 'text-danger-500' : 'text-ink-muted'}`}>{fieldError?.id === `binding-destination-${editKey ?? 'new'}` ? fieldError.message : bindingTarget === 'env' ? <>Use uppercase letters, numbers, and underscores, for example <span className="font-mono">DATABASE_URL</span>.</> : <>Use an absolute path, for example <span className="font-mono">/run/trellis-secrets/database</span>.</>}</p></div></div>
        </> : <><div className="space-y-2"><Label htmlFor={`variable-name-${editKey ?? 'new'}`}>Key</Label><Input id={`variable-name-${editKey ?? 'new'}`} value={key} onChange={(event) => setKey(event.target.value)} readOnly={Boolean(editKey)} required pattern="[A-Z_][A-Z0-9_]*" mono aria-invalid={fieldError?.id === `variable-name-${editKey ?? 'new'}`} aria-describedby={`variable-name-help-${editKey ?? 'new'}`} /><p id={`variable-name-help-${editKey ?? 'new'}`} className={`text-xs ${fieldError?.id === `variable-name-${editKey ?? 'new'}` ? 'text-danger-500' : 'text-ink-muted'}`}>{fieldError?.id === `variable-name-${editKey ?? 'new'}` ? fieldError.message : 'Use uppercase letters, numbers, and underscores.'}</p></div><div className="space-y-2"><Label htmlFor={`variable-value-${editKey ?? 'new'}`}>Value</Label><Input id={`variable-value-${editKey ?? 'new'}`} name="value" type="password" required={target === 'shared' || !editKey || selectedService?.envVars[editKey] === undefined} mono aria-invalid={fieldError?.id === `variable-value-${editKey ?? 'new'}`} aria-describedby={`variable-value-help-${editKey ?? 'new'}`} /><p id={`variable-value-help-${editKey ?? 'new'}`} className={`text-xs ${fieldError?.id === `variable-value-${editKey ?? 'new'}` ? 'text-danger-500' : 'text-ink-muted'}`}>{fieldError?.id === `variable-value-${editKey ?? 'new'}` ? fieldError.message : target === 'shared' ? 'Shared values are write-only. Enter a new value to create or rotate it.' : editKey && selectedService?.envVars[editKey] !== undefined ? 'Leave blank to keep the current service value.' : 'Enter the service value.'}</p></div></>}
      </DialogBody><DialogFooter><div className="mr-auto">{editKey ? <Button type="button" variant="default" onClick={remove} disabled={!canRemove || saving}><Trash2 className="h-3.5 w-3.5" />{target === 'shared' ? 'Delete shared variable' : 'Remove override'}</Button> : null}</div><Button type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant="primary" type="submit" aria-busy={saving}>{saving ? 'Saving…' : editKey ? 'Save changes' : 'Create variable'}</Button></DialogFooter></form>
    </DialogContent></Dialog>
}

function PasteDialog(props: VariablesSectionProps) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [target, setTarget] = useState(props.serviceId ?? 'shared'); const [error, setError] = useState<string | null>(null); const [fieldError, setFieldError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation(); setSaving(true); setError(null)
    try {
      const parsed = parseEnvText(String(new FormData(event.currentTarget).get('variables')))
      if (!parsed.length || parsed.some((row) => !row.key || !row.value || !/^[A-Z_][A-Z0-9_]*$/.test(row.key))) { setFieldError('Paste valid KEY=value lines using uppercase letters, numbers, and underscores.'); requestAnimationFrame(() => document.getElementById('paste-env')?.focus()); return }
      if (target === 'shared') for (const row of parsed) { const data = new FormData(); data.set('name', row.key); data.set('value', row.value); await setEnvironmentVariableAction(props.projectId, props.environmentId, data) }
      else {
        const service = props.services.find((item) => item.id === target); if (!service) throw new Error('Service not found.')
        const envVars = { ...service.envVars, ...Object.fromEntries(parsed.map((row) => [row.key, row.value])) }; const data = new FormData()
        data.set('envVars', JSON.stringify(Object.entries(envVars).map(([key, value]) => ({ key, value })))); data.set('secretBindings', JSON.stringify(service.secretBindings))
        const updated = { ...service, envVars }
        if (props.onServiceChange) props.onServiceChange(updated)
        else await updateServiceEnvironmentOverridesAction(service.id, props.environmentId, data)
      }
      setOpen(false); if (!props.onServiceChange || target === 'shared') router.refresh()
    } catch (cause) { setError(actionErrorMessage(cause, 'Could not import variables.')) } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setFieldError(null); setError(null) }}><DialogTrigger asChild><Button size="sm">Paste .env</Button></DialogTrigger><DialogContent size="lg"><DialogHeader><DialogTitle>Paste .env</DialogTitle></DialogHeader><form onSubmit={submit} onInvalid={(event) => { event.preventDefault(); const field = event.target as HTMLTextAreaElement; setFieldError(field.validationMessage); field.focus() }}><DialogBody className="space-y-4">{error ? <InlineNotice tone="error">{error}</InlineNotice> : null}<div className="space-y-2"><Label>Scope</Label><Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!props.serviceId ? <SelectItem value="shared">Shared</SelectItem> : null}{props.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="paste-env">Variables</Label><Textarea id="paste-env" name="variables" rows={10} required mono aria-invalid={Boolean(fieldError)} aria-describedby="paste-env-help" onInput={() => setFieldError(null)} /><p id="paste-env-help" className={`text-xs ${fieldError ? 'text-danger-500' : 'text-ink-muted'}`}>{fieldError ?? 'One KEY=value pair per line. Comments and export prefixes are supported.'}</p></div></DialogBody><DialogFooter><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" aria-busy={saving}>{saving ? 'Importing…' : 'Import variables'}</Button></DialogFooter></form></DialogContent></Dialog>
}
