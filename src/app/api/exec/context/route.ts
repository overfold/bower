import { timingSafeEqual } from 'node:crypto'
import { getExecSessionContext } from '@/lib/exec-context'
import { recordAudit } from '@/lib/actions/shared'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.BOWER_EXEC_INTERNAL_SECRET
  const supplied = Buffer.from(request.headers.get('x-bower-exec-secret') ?? '')
  if (!secret || supplied.length !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(secret), supplied)) {
    return new Response(null, { status: 404 })
  }
  try {
    const input = await request.json()
    if (typeof input.serviceConfigId !== 'string' || typeof input.allocationId !== 'string'
      || (input.task !== undefined && (typeof input.task !== 'string' || input.task.length > 256))
      || !Number.isInteger(input.cols) || input.cols < 1 || input.cols > 1000
      || !Number.isInteger(input.rows) || input.rows < 1 || input.rows > 1000) {
      return new Response(null, { status: 400 })
    }
    const { access, client, namespace } = await getExecSessionContext(input.serviceConfigId, input.check ? undefined : input.allocationId)
    if (input.check) return Response.json({ authorized: true })
    await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'allocation.terminal.opened',
      resourceType: 'service', resourceId: access.service.id, details: { allocationId: input.allocationId, task: input.task } })
    return Response.json(client.getExecConnection(input.allocationId, namespace, input.task, input.cols, input.rows),
      { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Do not expose DB/credential errors to the browser or the bridge log.
    return new Response(null, { status: 403 })
  }
}
