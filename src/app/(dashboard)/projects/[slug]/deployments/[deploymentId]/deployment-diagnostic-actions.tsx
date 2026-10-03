'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Rocket, RotateCcw, Settings2 } from 'lucide-react'
import { deployServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deploymentImageTag } from '@/lib/format'
import { useFeedback } from '@/components/ui/feedback'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export function DeploymentDiagnosticActions({ serviceId, serviceName, environmentId, failed, runningImage, rollbackTargets, configurationHref }: { serviceId: string; serviceName: string; environmentId: string; failed: boolean; runningImage?: string; rollbackTargets: { id: string; image: string }[]; configurationHref: string }) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState(rollbackTargets[0]?.id ?? '')
  const { toast } = useFeedback()
  const rollbackTarget = rollbackTargets.find((target) => target.id === selected)
  const rollbackImage = rollbackTarget?.image.split('/').at(-1)

  function redeploy() {
    startTransition(async () => {
      try {
        await deployServiceAction(serviceId, environmentId)
        toast({ tone: 'success', title: 'Redeployment started.' })
      } catch (reason) {
        toast({ tone: 'error', title: 'Could not redeploy', description: reason instanceof Error ? reason.message : 'The deployment could not be started.' })
      }
    })
  }

  return <div className="flex flex-wrap gap-2">
    {rollbackTarget ? <AlertDialog><AlertDialogTrigger asChild><Button variant={failed ? 'primary' : 'default'} size="sm" disabled={pending}><RotateCcw />{failed ? `Roll back to ${rollbackImage}` : 'Roll back…'}</Button></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back {serviceName}?</AlertDialogTitle><AlertDialogDescription>{runningImage ? <>Running <span className="font-mono">{deploymentImageTag(runningImage)}</span>. </> : null}This replaces the current workload with the selected successful release.</AlertDialogDescription></AlertDialogHeader>
        <div className="px-5 py-4"><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Rollback release" className="font-mono"><SelectValue /></SelectTrigger><SelectContent>{rollbackTargets.map((target) => <SelectItem key={target.id} value={target.id} className="font-mono">{deploymentImageTag(target.image)}</SelectItem>)}</SelectContent></Select></div>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className={buttonVariants({ variant: 'primary' })} disabled={pending} onClick={() => startTransition(async () => {
          try { await rollbackServiceAction(serviceId, environmentId, rollbackTarget.id); toast({ tone: 'success', title: 'Rollback started.' }) }
          catch (reason) { toast({ tone: 'error', title: 'Could not roll back', description: reason instanceof Error ? reason.message : 'The rollback could not be started.' }) }
        })}>Roll back</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog> : null}
    <Button variant={failed && !rollbackTarget ? 'primary' : 'default'} size="sm" loading={pending} onClick={redeploy}><Rocket />Redeploy</Button>
    <Button asChild variant="ghost" size="sm"><Link href={configurationHref}><Settings2 />Edit configuration</Link></Button>
  </div>
}
