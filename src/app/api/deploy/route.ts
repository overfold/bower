import { authenticateApiKey, authenticateApiKeyToken } from '@/lib/api-auth'
import { deployServiceFromAutomation } from '@/lib/actions/services'
import { BODY_LIMITS, readRequestBody, requestBodyErrorResponse } from '@/lib/request-body'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { environments } from '@/db/schema'

export async function POST(request: Request) {
  if (!await authenticateApiKeyToken(request.headers.get('authorization'))) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  let body: { serviceId?: string; environmentId?: string; image?: string }
  try { body = JSON.parse((await readRequestBody(request, BODY_LIMITS.deploy)).toString('utf8')) as typeof body } catch (error) { return requestBodyErrorResponse(error) }
  if (!body || typeof body.serviceId !== 'string' || typeof body.environmentId !== 'string' || typeof body.image !== 'string' || !body.serviceId || !body.environmentId || !body.image) return Response.json({ error: 'serviceId, environmentId, and image are required.' }, { status: 400 })
  const auth = await authenticateApiKey(request.headers.get('authorization'), body.serviceId); if (!auth) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const [environment] = await db.select().from(environments).where(and(eq(environments.id, body.environmentId), eq(environments.projectId, auth.project.id))).limit(1)
  if (!environment) return Response.json({ error: 'Environment not found.' }, { status: 404 })
  try {
    const result = await deployServiceFromAutomation(body.serviceId, body.environmentId, body.image, 'manual', auth.actor)
    return Response.json({ accepted: true, deploymentId: result.deployment.id }, { status: 202 })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Deployment failed.' }, { status: 502 }) }
}
