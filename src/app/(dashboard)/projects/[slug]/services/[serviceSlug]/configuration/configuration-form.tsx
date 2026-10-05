'use client'

import { useEffect, useRef, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { updateServiceConfigOverridesAction } from '@/lib/actions/base-service-config'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MergedServiceConfig } from '@/lib/queries'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
import type { TrellisJobLimits } from '@/types/trellis'
import { formatMemory } from '@/lib/format'
import { VariablesSection } from '@/components/variables-section'
import type { VariableService } from '@/lib/variable-matrix'
import { ChevronDown, ShieldAlert } from 'lucide-react'

interface ConfigurationFormProps {
  serviceId: string
  environmentId: string
  config: MergedServiceConfig | null
  limits?: TrellisJobLimits
  projectId: string
  serviceName: string
  sharedNames: string[]
  secretLabels: Record<string, string>
  canManage: boolean
  mayBypassMultitenancy: boolean
  environmentUpdatedAt: string
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join('\n')
}

function changedVariableCount(current: VariableService, baseline: VariableService) {
  const values = (service: VariableService) => new Map([
    ...Object.entries(service.envVars),
    ...service.secretBindings.map((binding) => [binding.target === 'env' ? binding.env : binding.path, JSON.stringify(binding)] as const),
  ])
  const currentValues = values(current); const baselineValues = values(baseline)
  return [...new Set([...currentValues.keys(), ...baselineValues.keys()])].filter((key) => currentValues.get(key) !== baselineValues.get(key)).length
}

function unsavedSummary(fieldCount: number, variableCount: number) {
  const fields = `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`
  const variables = `${variableCount} ${variableCount === 1 ? 'variable' : 'variables'}`
  if (fieldCount && variableCount) return `${fields}, ${variables}`
  if (fieldCount) return `${fieldCount} unsaved ${fieldCount === 1 ? 'field' : 'fields'}`
  return `${variableCount} unsaved ${variableCount === 1 ? 'variable' : 'variables'}`
}

export function ConfigurationForm({ serviceId, environmentId, config, limits, projectId, serviceName, sharedNames, secretLabels, canManage, mayBypassMultitenancy, environmentUpdatedAt }: ConfigurationFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthType, setHealthType] = useState(config?.healthCheckType ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [strategy, setStrategy] = useState(config?.deploymentStrategy ?? 'rolling')
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set())
  const setFieldDirty = (field: string, dirty: boolean) => setDirtyFields((current) => { const next = new Set(current); if (dirty) next.add(field); else next.delete(field); return next })
  const initialService: VariableService = { name: serviceName, id: serviceId, envVars: (config?.envVars ?? {}) as Record<string, string>, secretBindings: (config?.secretBindings ?? []) as VariableService['secretBindings'] }
  const [variableService, setVariableService] = useState(initialService)
  const [variableBaseline, setVariableBaseline] = useState(initialService)
  const initialRuntime = config?.runtime ?? 'runc'
  const initialAccess = config?.apiAccessScope && config.apiAccessLevel ? `${config.apiAccessScope}:${config.apiAccessLevel}` : 'none'
  const [runtime, setRuntime] = useState(initialRuntime)
  const [apiAccess, setApiAccess] = useState(initialAccess)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (window.location.hash === '#advanced') queueMicrotask(() => setAdvancedOpen(true))
  }, [])

  const d = {
    image: config?.image ?? '',
    replicas: config?.replicas ?? 1,
    cpu: (config?.cpu ?? 100) / 1000,
    memory: config ? config.memory / 1048576 : 128,
    deploymentStrategy: config?.deploymentStrategy ?? 'rolling',
    healthCheckPath: config?.healthCheckPath ?? '',
    healthCheckType: config?.healthCheckType ?? '',
    healthCheckPort: config?.healthCheckPort ?? '',
    healthCheckCommand: Array.isArray(config?.healthCheckCommand) ? (config.healthCheckCommand as string[]).join(' ') : '',
    healthCheckInterval: config?.healthCheckInterval ?? 10,
    healthCheckTimeout: config?.healthCheckTimeout ?? 2,
    healthCheckThreshold: config?.healthCheckThreshold ?? 3,
    autoRollbackSeconds: config?.autoRollbackSeconds ?? 300,
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(form)
      formData.set('cpu', String(Number(formData.get('cpu')) * 1000))
      formData.set('envVarsJson', JSON.stringify(Object.entries(variableService.envVars).map(([key, value]) => ({ key, value }))))
      formData.set('secretBindings', JSON.stringify(variableService.secretBindings))
      await updateServiceConfigOverridesAction(serviceId, environmentId, formData)
      setVariableBaseline(variableService)
      for (const field of form.elements) if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.defaultValue = field.value
      setDirtyFields(new Set())
      toast({ tone: 'success', title: 'Service configuration saved' })
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Something went wrong.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={(event) => { const field = event.target; if (!formRef.current?.contains(field as Node)) return; if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) setFieldDirty(field.name || field.id, field.value !== field.defaultValue) }} className="space-y-4" aria-busy={saving}>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <div className="hidden">
        <input type="hidden" name="resourceTier" value="custom" />
        <input type="hidden" name="envVarsJson" value={JSON.stringify(Object.entries(variableService.envVars).map(([key, value]) => ({ key, value })))} />
        <input type="hidden" name="labels" value={recordToLines(config?.labels)} />
        <input type="hidden" name="volumes" value={JSON.stringify(config?.volumes ?? [])} />
        <input type="hidden" name="secretBindings" value={JSON.stringify(variableService.secretBindings)} />
        <input type="hidden" name="canarySteps" value={JSON.stringify(config?.canarySteps ?? [10, 25, 50, 100])} />
        <input type="hidden" name="healthInterval" value={d.healthCheckInterval} />
        <input type="hidden" name="healthTimeout" value={d.healthCheckTimeout} />
        <input type="hidden" name="healthThreshold" value={d.healthCheckThreshold} />
        <input type="hidden" name="autoRollbackSeconds" value={d.autoRollbackSeconds} />
      </div>

      <Panel>
        <PanelHeader title="General" hint="Image and deployment behavior" />
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="image">Container image</Label>
            <Input id="image" name="image" defaultValue={d.image} required mono />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="replicas">Replicas</Label>
              <Input id="replicas" name="replicas" type="number" defaultValue={d.replicas} required min={1} max={limits?.max_replicas_per_task_group} />
              {limits ? <p className="text-xs text-ink-muted">Up to {limits.max_replicas_per_task_group} replicas</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategy">Deployment strategy</Label>
              <Select name="strategy" value={strategy} onValueChange={(value) => { setStrategy(value as typeof strategy); setFieldDirty('strategy', value !== d.deploymentStrategy) }}>
                <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling</SelectItem>
                  <SelectItem value="recreate">Recreate</SelectItem>
                  <SelectItem value="blue_green">Blue/green</SelectItem>
                  <SelectItem value="canary">Canary</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">{{ rolling: 'Replaces replicas one at a time. No downtime.', recreate: 'Stops existing replicas before starting replacements.', blue_green: 'Starts a complete replacement before switching traffic.', canary: 'Moves traffic to the new release in gradual steps.' }[strategy]}</p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Resources" hint="Compute reserved for each replica" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU</Label>
            <div className="relative"><Input id="cpu" name="cpu" type="number" defaultValue={d.cpu} min={0.001} max={limits ? limits.max_task_cpu / 1000 : undefined} step={0.001} className="pr-14" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">cores</span></div>
            {limits ? <p className="text-xs text-ink-muted">Up to {limits.max_task_cpu / 1000} cores per replica</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory">Memory</Label>
            <div className="relative"><Input id="memory" name="memory" type="number" defaultValue={d.memory} min={1} max={limits ? Math.floor(limits.max_task_memory / 1048576) : undefined} step={1} className="pr-10" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">MB</span></div>
            {limits ? <p className="text-xs text-ink-muted">Up to {formatMemory(limits.max_task_memory)} per replica</p> : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Health checks" hint="Determine when a deployment is ready and healthy" />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="healthType">Type</Label>
              <input type="hidden" name="healthType" value={healthType} />
              <Select value={healthType || 'none'} onValueChange={(value) => { const next = value === 'none' ? '' : value; setHealthType(next); setFieldDirty('healthType', next !== d.healthCheckType) }}>
                <SelectTrigger id="healthType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="script">Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {healthType === 'script' && (
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="healthCommand">Command</Label>
                <Input id="healthCommand" name="healthCommand" defaultValue={d.healthCheckCommand} required mono />
              </div>
            )}
            {healthType === 'http' && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="healthPath">Path</Label>
                <Input id="healthPath" name="healthPath" defaultValue={d.healthCheckPath} mono />
              </div>
            )}
            {(healthType === 'http' || healthType === 'tcp') && (
              <div className={`space-y-2 ${healthType === 'tcp' ? 'sm:col-span-3' : ''}`}>
                <Label htmlFor="healthPort">Port</Label>
                <Input id="healthPort" name="healthPort" type="number" min={1} max={65535} defaultValue={d.healthCheckPort} required />
              </div>
            )}
          </div>

        </div>
      </Panel>

      <VariablesSection projectId={projectId} environmentId={environmentId} sharedNames={sharedNames} services={[variableService]} secretLabels={secretLabels} canManage={canManage} serviceId={serviceId} updatedAt={environmentUpdatedAt} onServiceChange={setVariableService} />

      <section id="advanced" className="rounded-xl border border-line bg-surface">
        <PanelHeader title="Advanced" hint="Runtime and workload API access" className={!advancedOpen ? 'border-b-0' : undefined} action={<Button type="button" variant="ghost" size="icon" aria-label="Toggle advanced configuration" aria-expanded={advancedOpen} aria-controls="advanced-content" onClick={() => setAdvancedOpen((open) => !open)}><ChevronDown className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></Button>} />
        <div id="advanced-content" hidden={!advancedOpen} className={advancedOpen ? 'grid gap-5 p-4 md:grid-cols-2' : 'hidden'}>
          <div className="space-y-2"><Label htmlFor="runtime">Isolation</Label><Select name="runtime" value={runtime} onValueChange={(value) => { setRuntime(value as 'runc' | 'runsc'); setFieldDirty('runtime', value !== initialRuntime) }}><SelectTrigger id="runtime"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="runc">None</SelectItem><SelectItem value="runsc">Sandboxed</SelectItem></SelectContent></Select><p className="text-xs text-ink-muted">Sandboxed workloads use stronger process isolation for the whole service.</p></div>
          <div className="space-y-2"><Label htmlFor="apiAccess">Workload API access</Label><Select name="apiAccess" value={apiAccess} onValueChange={(value) => { setApiAccess(value); setFieldDirty('apiAccess', value !== initialAccess) }}><SelectTrigger id="apiAccess"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{mayBypassMultitenancy ? <><SelectItem value="cluster:read">Cluster · read</SelectItem><SelectItem value="cluster:write">Cluster · write</SelectItem></> : null}</SelectContent></Select><p className="text-xs text-ink-muted">Cluster-wide API access can only be enabled by an instance admin.</p></div>
          {apiAccess !== 'none' ? <div className="md:col-span-2"><InlineNotice tone="warn" icon={<ShieldAlert className="mt-0.5 h-4 w-4" />}>This service has cluster-wide workload API access.</InlineNotice></div> : null}
        </div>
      </section>

      <UnsavedChangesBar dirty={dirtyFields.size > 0 || changedVariableCount(variableService, variableBaseline) > 0} summary={unsavedSummary(dirtyFields.size, changedVariableCount(variableService, variableBaseline))} pending={saving} onSave={() => formRef.current?.requestSubmit()} onDiscard={() => { formRef.current?.reset(); setDirtyFields(new Set()); setError(null); setHealthType(config?.healthCheckType ?? ''); setStrategy(config?.deploymentStrategy ?? 'rolling'); setVariableService(variableBaseline); setRuntime(initialRuntime); setApiAccess(initialAccess) }} />
    </form>
  )
}
