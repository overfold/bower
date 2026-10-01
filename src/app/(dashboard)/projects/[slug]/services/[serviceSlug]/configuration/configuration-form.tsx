'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { updateServiceConfigOverridesAction } from '@/lib/actions/base-service-config'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MergedServiceConfig } from '@/lib/queries'

interface ConfigurationFormProps {
  serviceId: string
  environmentId: string
  config: MergedServiceConfig | null
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join('\n')
}

export function ConfigurationForm({ serviceId, environmentId, config }: ConfigurationFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthType, setHealthType] = useState(config?.healthCheckType ?? '')

  const d = {
    image: config?.image ?? '',
    replicas: config?.replicas ?? 1,
    cpu: config?.cpu ?? 100,
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
      await updateServiceConfigOverridesAction(serviceId, environmentId, formData)
      toast({ tone: 'success', title: 'Service configuration saved.' })
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Something went wrong.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={saving}>
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
              <Input id="replicas" name="replicas" type="number" defaultValue={d.replicas} required min={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategy">Deployment strategy</Label>
              <Select name="strategy" defaultValue={d.deploymentStrategy}>
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
            <Label htmlFor="cpu">CPU (millicores)</Label>
            <Input id="cpu" name="cpu" type="number" defaultValue={d.cpu} min={1} step={1} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory">Memory (MB)</Label>
            <Input id="memory" name="memory" type="number" defaultValue={d.memory} min={1 / 1048576} step="any" required />
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
              <Select value={healthType || 'none'} onValueChange={(value) => setHealthType(value === 'none' ? '' : value)}>
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

      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving…' : 'Save configuration'}
        </Button>
      </div>
    </form>
  )
}
