import Link from 'next/link'
import { InlineNotice } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { RestartCountdown } from '@/components/restart-countdown'
import { Time } from '@/components/time'
import type { ServiceFailure } from '@/lib/service-failure'

const titles: Record<ServiceFailure['kind'], string> = {
  restart_backoff: 'Failing, restart pending',
  allocation: 'Failing',
  unplaceable: 'Cannot be placed',
}

/** The cause of a failing service, in the page body where people look first (not only in the status popover). */
export function ServiceFailureNotice({ failure, logsHref }: { failure: ServiceFailure; logsHref?: string }) {
  const facts = [
    failure.failures ? <span key="failures">{failure.failures} {failure.failures === 1 ? 'failure' : 'failures'}</span> : null,
    failure.nextAttemptAt ? <span key="next"><RestartCountdown at={failure.nextAttemptAt} /></span> : null,
    failure.failingSince ? <span key="since">Failing since <Time value={failure.failingSince} /></span> : null,
  ].filter(Boolean)
  return <InlineNotice tone="danger" action={logsHref ? <Button asChild size="sm"><Link href={logsHref}>View logs</Link></Button> : undefined}>
    <p className="font-medium">{titles[failure.kind]}</p>
    <p className="mt-0.5 break-words">{failure.cause}</p>
    {failure.details.map((detail) => <p key={detail} className="mt-0.5 break-words text-xs text-ink-muted">{detail}</p>)}
    {facts.length ? <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">{facts}</p> : null}
  </InlineNotice>
}
