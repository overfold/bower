import { createAutomationApiKeyAction, revokeApiKeyAction } from '@/lib/actions/settings'
import { getCurrentUser } from '@/lib/auth'
import { isResourceId } from '@/lib/automation'
import { BODY_LIMITS, readRequestBody, requestBodyErrorResponse } from '@/lib/request-body'

export async function POST(request: Request) {
  // Credential creation is session-only. Do not let a bearer key mint another key.
  if (request.headers.get('origin') !== new URL(process.env.BOWER_PUBLIC_URL || request.url).origin) return Response.json({ error: 'Same-origin request required.' }, { status: 403 })
  if (!await getCurrentUser()) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  let input
  try { input = JSON.parse((await readRequestBody(request, BODY_LIMITS.deploy)).toString('utf8')) }
  catch (error) { return requestBodyErrorResponse(error) }
  if (!input || typeof input.name !== 'string' || !isResourceId(input.projectId) || !isResourceId(input.environmentId) || typeof input.expiresAt !== 'string' || !Array.isArray(input.scopes)) {
    return Response.json({ error: 'name, projectId, environmentId, scopes and expiresAt are required.' }, { status: 400 })
  }
  const result = await createAutomationApiKeyAction(input)
  return Response.json(result, { status: result.error ? 400 : 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BOWER_PUBLIC_URL || request.url).origin) return Response.json({ error: 'Same-origin request required.' }, { status: 403 })
  if (!await getCurrentUser()) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!isResourceId(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })
  await revokeApiKeyAction(id)
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
