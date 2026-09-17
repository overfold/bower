import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { webhookEndpoints } from '@/db/schema'
import { deployServiceFromAutomation } from '@/lib/actions/services'

function imageFromPayload(provider: string, payload: Record<string, unknown>) {
  if (provider === 'docker_hub') {
    const repository = payload.repository as { repo_name?: string } | undefined; const push = payload.push_data as { tag?: string; digest?: string } | undefined
    return push?.digest ? `${repository?.repo_name}@${push.digest}` : repository?.repo_name && push?.tag ? `${repository.repo_name}:${push.tag}` : null
  }
  if (provider === 'ghcr') {
    const pkg = payload.package as { name?: string; package_version?: { name?: string; container_metadata?: { tag?: { name?: string }; manifest?: { digest?: string } } } } | undefined
    const digest = pkg?.package_version?.container_metadata?.manifest?.digest; const tag = pkg?.package_version?.container_metadata?.tag?.name || pkg?.package_version?.name
    return pkg?.name && digest ? `ghcr.io/${pkg.name}@${digest}` : pkg?.name && tag ? `ghcr.io/${pkg.name}:${tag}` : null
  }
  return typeof payload.image === 'string' ? payload.image : null
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const raw = await request.text(); const tokenHash = createHash('sha256').update(token).digest('hex')
  const [hook] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.tokenHash, tokenHash)).limit(1)
  if (!hook?.isActive) return Response.json({ error: 'Webhook not found.' }, { status: 404 })
  const supplied = (request.headers.get('x-bower-signature') || request.headers.get('x-hub-signature-256') || '').replace(/^sha256=/, '')
  const expected = createHmac('sha256', token).update(raw).digest('hex')
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return Response.json({ error: 'Invalid signature.' }, { status: 401 })
  let payload: Record<string, unknown>; try { payload = JSON.parse(raw) as Record<string, unknown> } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const image = imageFromPayload(hook.provider, payload); if (!image) return Response.json({ error: 'No image was found in the payload.' }, { status: 422 })
  const tag = image.includes(':') ? image.slice(image.lastIndexOf(':') + 1) : ''; const digest = image.includes('@sha256:')
  if (hook.deployMode === 'digest' && !digest) return Response.json({ ignored: true, reason: 'digest required' })
  if (hook.deployMode === 'tag' && (!tag || (hook.tagFilter && !new RegExp(hook.tagFilter).test(tag)))) return Response.json({ ignored: true, reason: 'tag did not match' })
  try {
    const result = await deployServiceFromAutomation(hook.serviceId, hook.environmentId, image, 'webhook')
    return Response.json({ accepted: true, deploymentId: result.deployment.id }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deployment failed.'
    return Response.json({ error: message }, { status: 502 })
  }
}
