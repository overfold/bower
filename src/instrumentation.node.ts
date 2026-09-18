import { createHash, randomBytes } from 'node:crypto'

declare global {
  var bowerDeploymentMonitor: NodeJS.Timeout | undefined
}

async function seedDefaultOrg() {
  const { db } = await import('@/db')
  const { organizations, instanceTokens } = await import('@/db/schema')
  const { sql } = await import('drizzle-orm')

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)

  if (count > 0) return

  const apiUrl = process.env.TRELLIS_ADDR ?? process.env.TRELLIS_API_URL ?? ''
  const apiToken = process.env.TRELLIS_TOKEN ?? process.env.TRELLIS_API_TOKEN ?? ''

  await db
    .insert(organizations)
    .values({
      name: 'Default',
      slug: 'default',
      trellisApiUrl: apiUrl,
      trellisApiToken: apiToken,
    })

  const rawToken = `bi_${randomBytes(24).toString('base64url')}`
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const tokenPrefix = rawToken.slice(0, 11)

  await db.insert(instanceTokens).values({
    tokenHash,
    tokenPrefix,
    note: 'Bootstrap instance admin token',
  })

  const line = '═'.repeat(60)
  console.log(`\n╔${line}╗`)
  console.log('║           Bower — First Run Setup                         ║')
  console.log(`╠${line}╣`)
  console.log('║  Use this token to create the first account:              ║')
  console.log(`║  ${rawToken.padEnd(58)}║`)
  console.log('║                                                            ║')
  console.log('║  This token grants instance admin access.                  ║')
  console.log('║  It is single-use. Keep it safe.                           ║')
  console.log(`╚${line}╝\n`)
}

export async function registerNodeInstrumentation() {
  if (globalThis.bowerDeploymentMonitor) return

  if (process.env.AUTO_MIGRATE === 'true') {
    const { runMigrations } = await import('@/db/migrate')
    await runMigrations()
  }

  await seedDefaultOrg().catch((err) =>
    console.error('Bower default org seeding failed:', err)
  )

  const { reconcileAllDeployments } = await import('@/lib/deployment-reconciler')
  const seconds = Math.max(2, Number(process.env.BOWER_RECONCILE_INTERVAL || 5))
  const reconcile = () => void reconcileAllDeployments().catch((error) => console.error('Bower deployment reconciliation failed:', error))
  reconcile()
  globalThis.bowerDeploymentMonitor = setInterval(reconcile, seconds * 1000)
  globalThis.bowerDeploymentMonitor.unref()
}
