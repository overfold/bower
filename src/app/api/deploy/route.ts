import { authenticateApiKey } from '@/lib/api-auth'
import { deployServiceFromAutomation } from '@/lib/actions/services'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { environments } from '@/db/schema'

export async function POST(request: Request) {
  let body: { serviceId?: string; environmentId?: string; image?: string }; try { body = await request.json() as typeof body } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (!body.serviceId || !body.environmentId || !body.image) return Response.json({ error: 'serviceId, environmentId, and image are required.' }, { status: 400 })
  const auth = await authenticateApiKey(request.headers.get('authorization'), body.serviceId); if (!auth) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const [environment] = await db.select().from(environments).where(and(eq(environments.id, body.environmentId), eq(environments.projectId, auth.project.id))).limit(1)
  if (!environment) return Response.json({ error: 'Environment not found.' }, { status: 404 })
  try {
    const result = await deployServiceFromAutomation(body.serviceId, body.environmentId, body.image, 'manual', auth.key.userId)
    return Response.json({ accepted: true, deploymentId: result.deployment.id }, { status: 202 })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Deployment failed.' }, { status: 502 }) }
}
