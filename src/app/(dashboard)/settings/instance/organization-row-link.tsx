'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronRight } from 'lucide-react'
import { switchOrgAction } from '@/lib/auth-actions'

export function OrganizationRowLink({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} aria-label={`Switch to ${organizationName}`} className="ml-auto block after:absolute after:inset-0 disabled:opacity-50" onClick={() => startTransition(async () => { await switchOrgAction(organizationId); router.push('/settings/organization'); router.refresh() })}><ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" /></button>
}
