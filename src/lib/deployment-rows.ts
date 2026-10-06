/**
 * "Succeeded" describes the release, not the service. Marks the newest successful deployment of each
 * service with the service's live health so a list doesn't read as healthy while the service is failing.
 */
export function withServiceHealth<T extends { deployment: { serviceId: string; status: string; createdAt: Date } }>(rows: T[], healthByService: Map<string, string>) {
  const newest = new Map<string, T>()
  for (const row of rows) {
    const current = newest.get(row.deployment.serviceId)
    if (!current || row.deployment.createdAt > current.deployment.createdAt) newest.set(row.deployment.serviceId, row)
  }
  return rows.map((row) => ({ ...row, serviceHealth: newest.get(row.deployment.serviceId) === row && row.deployment.status === 'healthy' ? healthByService.get(row.deployment.serviceId) ?? null : null }))
}
