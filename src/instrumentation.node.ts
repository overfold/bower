import { createHash, randomBytes } from 'node:crypto'

declare global {
  var bowerDeploymentMonitor: NodeJS.Timeout | undefined
}

async function seedDefaultOrg() {
  const { db } = await import('@/db')
  const { organizations, invitations } = await import('@/db/schema')
  const { sql } = await import('drizzle-orm')

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)

  if (count > 0) return

  const useWorkloadIdentity = Boolean(process.env.TRELLIS_ADDR && process.env.TRELLIS_TOKEN)
  const apiUrl = useWorkloadIdentity ? '' : process.env.TRELLIS_API_URL ?? ''
  const apiToken = useWorkloadIdentity ? '' : process.env.TRELLIS_API_TOKEN ?? ''

  const [organization] = await db
    .insert(organizations)
    .values({
      name: 'Default',
      slug: 'default',
      trellisApiUrl: apiUrl,
      trellisApiToken: apiToken,
      useTrellisWorkloadIdentity: useWorkloadIdentity,
    })
    .onConflictDoNothing({ target: organizations.slug })
    .returning({ id: organizations.id })

  // Another replica may have created the bootstrap organization while this
  // replica was between the count and insert queries.
  if (!organization) return

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const inviteUrl = `${(process.env.BOWER_PUBLIC_URL ?? '').replace(/\/$/, '')}/invite/${rawToken}`

  await db.insert(invitations).values({
    orgId: organization.id,
    tokenHash,
    organizationRole: 'owner',
    grantInstanceAdmin: true,
    note: 'Bootstrap instance admin token',
  })

  const line = '═'.repeat(60)
  console.log(`\n╔${line}╗`)
  console.log('║           Bower — First Run Setup                         ║')
  console.log(`╠${line}╣`)
  console.log('║  Open this link to create the first account:              ║')
  console.log(`║  ${inviteUrl}`.padEnd(60) + '║')
  console.log('║                                                            ║')
  console.log('║  This invitation grants owner and instance admin access.  ║')
  console.log('║  It is single-use. Keep it safe.                           ║')
  console.log(`╚${line}╝\n`)
}

export async function registerNodeInstrumentation() {
  if (globalThis.bowerDeploymentMonitor) return

  await seedDefaultOrg().catch((err) =>
    console.error('Bower default org seeding failed:', err)
  )

  const { reconcileAllDeployments } = await import('@/lib/deployment-reconciler')
  const { reconcileManagedIngress } = await import('@/lib/managed-proxy')
  const { trellisReadError } = await import('@/lib/trellis-runtime')
  const seconds = Math.max(2, Number(process.env.BOWER_RECONCILE_INTERVAL || 5))
  let running = false
  const reconcile = async () => {
    if (running) return
    running = true
    try {
      await reconcileManagedIngress()
      await reconcileAllDeployments()
    } catch (error) { console.error('Bower reconciliation failed:', trellisReadError(error)) }
    finally { running = false }
  }
  reconcile()
  globalThis.bowerDeploymentMonitor = setInterval(reconcile, seconds * 1000)
  globalThis.bowerDeploymentMonitor.unref()
}
