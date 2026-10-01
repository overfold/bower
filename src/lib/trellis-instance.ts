import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { TrellisClient } from '@/lib/trellis'
import { resolveTrellisConnection } from '@/lib/trellis-connection'

export { hasTrellisConnection } from '@/lib/trellis-connection'

export async function getTrellisClient(orgId: string): Promise<TrellisClient> {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (rows.length === 0) {
    throw new Error(`Organization not found: ${orgId}`)
  }

  const org = rows[0]
  const connection = resolveTrellisConnection(org)
  return new TrellisClient(connection.apiUrl, connection.apiToken, connection.caCert)
}

export function getTrellisClientFromEnv(): TrellisClient {
  const apiUrl = process.env.TRELLIS_API_URL
  const apiToken = process.env.TRELLIS_API_TOKEN

  if (!apiUrl) {
    throw new Error(
      'TRELLIS_API_URL environment variable is not set. ' +
        'Set it to the base URL of the Trellis API (e.g. http://localhost:8128).',
    )
  }

  if (!apiToken) {
    throw new Error(
      'TRELLIS_API_TOKEN environment variable is not set. ' +
        'Set it to a valid Trellis bearer token with cluster/write scope.',
    )
  }

  return new TrellisClient(apiUrl, apiToken)
}
