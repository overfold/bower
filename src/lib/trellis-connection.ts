export interface TrellisOrganizationConnection {
  trellisApiUrl: string
  trellisApiToken: string
  useTrellisWorkloadIdentity: boolean
}

interface TrellisEnvironment {
  TRELLIS_ADDR?: string
  TRELLIS_TOKEN?: string
  TRELLIS_CA_CERT?: string
}

function runtimeTrellisEnvironment(): TrellisEnvironment {
  return {
    TRELLIS_ADDR: process.env.TRELLIS_ADDR,
    TRELLIS_TOKEN: process.env.TRELLIS_TOKEN,
    TRELLIS_CA_CERT: process.env.TRELLIS_CA_CERT,
  }
}

export function resolveTrellisConnection(
  org: TrellisOrganizationConnection,
  env: TrellisEnvironment = runtimeTrellisEnvironment(),
): { apiUrl: string; apiToken: string; caCert?: string } {
  if (org.useTrellisWorkloadIdentity) {
    const apiUrl = env.TRELLIS_ADDR
    const apiToken = env.TRELLIS_TOKEN
    if (!apiUrl || !apiToken) {
      throw new Error('Trellis workload credentials were not injected into this Bower allocation.')
    }
    return { apiUrl, apiToken, caCert: env.TRELLIS_CA_CERT || undefined }
  }

  if (!org.trellisApiUrl || !org.trellisApiToken) {
    throw new Error('Trellis credentials have not been configured for this organization.')
  }
  return { apiUrl: org.trellisApiUrl, apiToken: org.trellisApiToken }
}

export function hasTrellisConnection(
  org: TrellisOrganizationConnection,
  env: TrellisEnvironment = runtimeTrellisEnvironment(),
): boolean {
  if (org.useTrellisWorkloadIdentity) {
    return Boolean(env.TRELLIS_ADDR && env.TRELLIS_TOKEN)
  }
  return Boolean(org.trellisApiUrl && org.trellisApiToken)
}
