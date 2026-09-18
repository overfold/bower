'use client'

import { useTransition } from 'react'
import { setNodeDrainAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'

interface DrainToggleProps {
  nodeId: string
  drain: boolean
}

export function DrainToggle({ nodeId, drain }: DrainToggleProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await setNodeDrainAction(nodeId, !drain)
    })
  }

  return (
    <Button
      variant={drain ? 'danger' : 'default'}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? 'Updating...' : drain ? 'Draining' : 'Drain'}
    </Button>
  )
}
