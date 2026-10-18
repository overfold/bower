import { AutomationError, deployApplication, readApplication, recoverApplication, type ApplicationRead } from '@/lib/automation'
import { authenticateApiKeyToken } from '@/lib/api-auth'
import { ActionError } from '@/lib/action-error'
import { TrellisApiError } from '@/lib/trellis'
import { trellisReadError, trellisWriteError } from '@/lib/trellis-runtime'
import { BODY_LIMITS, readRequestBody, requestBodyErrorResponse } from '@/lib/request-body'

const headers = { 'Cache-Control': 'no-store' }

function failure(error: unknown, write = false) {
  if (error instanceof AutomationError) return Response.json({ error: error.message }, { status: error.status, headers })
  if (error instanceof ActionError) return Response.json({ error: error.message }, { status: 400, headers })
  return Response.json({ error: write ? (error instanceof TrellisApiError ? trellisWriteError(error) : 'Unable to perform service operation.') : trellisReadError(error) }, { status: 502, headers })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const operation = params.get('operation')
  let input: ApplicationRead
  if (operation === 'projects') input = { operation }
  else if (operation === 'environments' || operation === 'services') input = { operation, projectId: params.get('projectId') ?? '' }
  else if (operation === 'deployments' || operation === 'allocations') input = { operation, serviceId: params.get('serviceId') ?? '', environmentId: params.get('environmentId') ?? '' }
  else if (operation === 'logs' || operation === 'metrics') input = { operation, serviceId: params.get('serviceId') ?? '', environmentId: params.get('environmentId') ?? '', allocationId: params.get('allocationId') ?? '', task: params.get('task') ?? undefined }
  else return Response.json({ error: 'Unknown read operation.' }, { status: 400, headers })
  try { return Response.json(await readApplication(request.headers.get('authorization'), input), { headers }) }
  catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  if (!await authenticateApiKeyToken(request.headers.get('authorization'))) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers })
  let input
  try { input = JSON.parse((await readRequestBody(request, BODY_LIMITS.deploy)).toString('utf8')) }
  catch (error) { return requestBodyErrorResponse(error) }
  try { return Response.json(await deployApplication(request.headers.get('authorization'), input), { status: 202, headers }) }
  catch (error) { return failure(error, true) }
}

export async function PATCH(request: Request) {
  if (!await authenticateApiKeyToken(request.headers.get('authorization'))) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers })
  let input
  try { input = JSON.parse((await readRequestBody(request, BODY_LIMITS.deploy)).toString('utf8')) }
  catch (error) { return requestBodyErrorResponse(error) }
  try { return Response.json(await recoverApplication(request.headers.get('authorization'), input), { status: 202, headers }) }
  catch (error) { return failure(error, true) }
}
