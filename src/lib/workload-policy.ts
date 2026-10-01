import type { TrellisApiAccess } from '@/types/trellis'

export function instanceAdminBypassEnabled(env: Record<string, string | undefined> = process.env) {
  return env.BOWER_IA_BYPASS_MULTITENANCY === 'true'
}

export function instanceAdminMayBypassMultitenancy(
  isInstanceAdmin: boolean,
  env: Record<string, string | undefined> = process.env,
) {
  return isInstanceAdmin && instanceAdminBypassEnabled(env)
}

export function assertHostPathAllowed(
  path: string,
  isInstanceAdmin: boolean,
  env: Record<string, string | undefined> = process.env,
) {
  if (!path.startsWith('@/') && !instanceAdminMayBypassMultitenancy(isInstanceAdmin, env)) {
    throw new Error('Absolute host paths require an instance admin and BOWER_IA_BYPASS_MULTITENANCY=true.')
  }
}

export function assertWorkloadApiAccessAllowed(
  access: TrellisApiAccess | undefined,
  isInstanceAdmin: boolean,
  env: Record<string, string | undefined> = process.env,
) {
  if (access && (access.scope === 'cluster' || access.access === 'write') && !instanceAdminMayBypassMultitenancy(isInstanceAdmin, env)) {
    throw new Error('Cluster-scoped or write workload API access requires an instance admin and BOWER_IA_BYPASS_MULTITENANCY=true.')
  }
}

export function assertStoredHostPathAllowed(path: string, env: Record<string, string | undefined> = process.env) {
  if (!path.startsWith('@/') && !instanceAdminBypassEnabled(env)) {
    throw new Error('This workload uses an absolute host path, but BOWER_IA_BYPASS_MULTITENANCY is not enabled.')
  }
}

export function assertStoredWorkloadApiAccessAllowed(access: TrellisApiAccess | undefined, env: Record<string, string | undefined> = process.env) {
  if (access && (access.scope === 'cluster' || access.access === 'write') && !instanceAdminBypassEnabled(env)) {
    throw new Error('This workload has cluster-scoped or write API access, but BOWER_IA_BYPASS_MULTITENANCY is not enabled.')
  }
}
