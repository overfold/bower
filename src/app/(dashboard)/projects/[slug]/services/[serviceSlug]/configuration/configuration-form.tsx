'use client'

import { useRef, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { updateServiceConfigOverridesAction } from '@/lib/actions/base-service-config'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MergedServiceConfig } from '@/lib/queries'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
import type { TrellisJobLimits } from '@/types/trellis'

interface ConfigurationFormProps {
  serviceId: string
  environmentId: string
  config: MergedServiceConfig | null
  limits?: TrellisJobLimits
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join('\n')
}

export function ConfigurationForm({ serviceId, environmentId, config, limits }: ConfigurationFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthType, setHealthType] = useState(config?.healthCheckType ?? '')
  const [strategy, setStrategy] = useState(config?.deploymentStrategy ?? 'rolling')
  const [dirty, setDirty] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

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
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('cpu', String(Number(formData.get('cpu')) * 1000))
      await updateServiceConfigOverridesAction(serviceId, environmentId, formData)
      setDirty(false)
      toast({ tone: 'success', title: 'Service configuration saved.' })
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Something went wrong.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={(event) => { if (!(event.target instanceof HTMLSelectElement)) setDirty(true) }} className="space-y-4" aria-busy={saving}>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="hidden">
        <input type="hidden" name="resourceTier" value="custom" />
        <input type="hidden" name="envVars" value={recordToLines(config?.envVars)} />
        <input type="hidden" name="labels" value={recordToLines(config?.labels)} />
        <input type="hidden" name="volumes" value={JSON.stringify(config?.volumes ?? [])} />
        <input type="hidden" name="secretBindings" value={JSON.stringify(config?.secretBindings ?? [])} />
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
              <Input id="replicas" name="replicas" type="number" className="w-36" defaultValue={d.replicas} required min={1} max={limits?.max_replicas_per_task_group} />
              {limits ? <p className="text-xs text-ink-muted">Up to {limits.max_replicas_per_task_group} replicas</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategy">Deployment strategy</Label>
              <Select name="strategy" value={strategy} onValueChange={(value) => { setStrategy(value as typeof strategy); setDirty(true) }}>
                <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling</SelectItem>
                  <SelectItem value="recreate">Recreate</SelectItem>
                  <SelectItem value="blue_green">Blue/green</SelectItem>
                  <SelectItem value="canary">Canary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Resources" hint="Compute reserved for each replica" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU</Label>
            <div className="relative max-w-48"><Input id="cpu" name="cpu" type="number" defaultValue={d.cpu} min={0.001} max={limits ? limits.max_task_cpu / 1000 : undefined} step={0.001} className="pr-14" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">cores</span></div>
            {limits ? <p className="text-xs text-ink-muted">Up to {limits.max_task_cpu / 1000} cores per replica</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory">Memory</Label>
            <div className="relative max-w-48"><Input id="memory" name="memory" type="number" defaultValue={d.memory} min={1} max={limits ? Math.floor(limits.max_task_memory / 1048576) : undefined} step={1} className="pr-10" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">MB</span></div>
            {limits ? <p className="text-xs text-ink-muted">Up to {Math.floor(limits.max_task_memory / 1048576)} MB per replica</p> : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Health checks" hint="Determine when a deployment is ready and healthy" />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="healthType">Type</Label>
              <input type="hidden" name="healthType" value={healthType} />
              <Select value={healthType || 'none'} onValueChange={(value) => { setHealthType(value === 'none' ? '' : value); setDirty(true) }}>
                <SelectTrigger id="healthType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="script">Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {healthType === 'http' && (
              <div className="space-y-2">
                <Label htmlFor="healthPath">Path</Label>
                <Input id="healthPath" name="healthPath" defaultValue={d.healthCheckPath} mono />
              </div>
            )}
            {(healthType === 'http' || healthType === 'tcp') && (
              <div className="space-y-2">
                <Label htmlFor="healthPort">Port</Label>
                <Input id="healthPort" name="healthPort" type="number" min={1} max={65535} defaultValue={d.healthCheckPort} required />
              </div>
            )}
          </div>

          {healthType === 'script' && (
            <div className="space-y-2">
              <Label htmlFor="healthCommand">Command</Label>
              <Input id="healthCommand" name="healthCommand" defaultValue={d.healthCheckCommand} required mono />
            </div>
          )}
        </div>
      </Panel>

      <UnsavedChangesBar dirty={dirty} pending={saving} onSave={() => formRef.current?.requestSubmit()} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null); setHealthType(config?.healthCheckType ?? ''); setStrategy(config?.deploymentStrategy ?? 'rolling') }} />
    </form>
  )
}
