const labels: Record<string, string> = {
  rolled_back: 'Rolled back', 'rolled-back': 'Rolled back',
  never: 'Not deployed', nonvoter: 'Non-voter', voter: 'Voter',
  fresh: 'Fresh', stale: 'Stale', auto: 'Automatic', none: 'Public',
  instance_admin: 'Instance admin', user: 'User', admin: 'Admin',
}

export const roleLabels = { viewer: 'Viewer', deployer: 'Deployer', admin: 'Admin', owner: 'Owner', member: 'Member' } as const
export const organizationRoleLabels = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const
export const instanceRoleLabels = { admin: 'Admin', user: 'User' } as const
export const tlsLabels = { auto: 'Automatic HTTPS', custom: 'Custom certificate', none: 'HTTP only' } as const
export const protectionLabels = { none: 'Public', password: 'Password protected', bower_auth: 'Bower account' } as const
export const heartbeatLabels = { fresh: 'Fresh', stale: 'Stale', never: 'Never' } as const
export const deploymentStrategyLabels = { rolling: 'Rolling', recreate: 'Recreate', blue_green: 'Blue/green', canary: 'Canary' } as const
export const deploymentTriggerLabels = { manual: 'Manual', webhook: 'Webhook', promotion: 'Promotion', rollback: 'Rollback', auto_rollback: 'Automatic rollback' } as const
export const deploymentStatusLabels = { pending: 'In progress', planning: 'In progress', deploying: 'In progress', healthy: 'Succeeded', failed: 'Failed', rolled_back: 'Rolled back' } as const
export const providerLabels = { generic: 'Generic', docker_hub: 'Docker Hub', ghcr: 'GitHub Container Registry' } as const
export const deployModeLabels = { any_push: 'Any push', tag: 'Tag', digest: 'Digest' } as const

export function label(value: string): string {
  return labels[value] ?? (value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '))
}

export function auditResourceName(entry: { resourceName?: string; details: Record<string, unknown>; resourceType?: string }): string | undefined {
  if (entry.resourceName) return entry.resourceName
  for (const key of ['name', 'serviceName', 'hostname', 'domain', 'teamName']) {
    if (typeof entry.details[key] === 'string') return entry.details[key] as string
  }
  const after = entry.details.after
  if (after && typeof after === 'object' && 'name' in after && typeof after.name === 'string') return after.name
  return entry.resourceType ? `the ${entry.resourceType.replaceAll('_', ' ')}` : undefined
}

export function auditActionSentence(action: string, resourceName?: string, details: Record<string, unknown> = {}): string {
  const name = resourceName || 'the resource'
  const member = typeof details.email === 'string' ? details.email : typeof details.memberName === 'string' ? details.memberName : 'a member'
  const sentences: Record<string, string> = {
    'team.member.add': `added ${member} to ${name}`,
    'team.member.added': `added ${member} to ${name}`,
    'team.member.remove': `removed ${member} from ${name}`,
    'team.member.removed': `removed ${member} from ${name}`,
    'route.create': `created route ${name}`,
    'route.created': `created route ${name}`,
    'route.delete': `deleted route ${name}`,
    'route.deleted': `deleted route ${name}`,
    'route.protection.updated': `updated access protection for ${name}`,
    'service.create': `created service ${name}`,
    'service.created': `created service ${name}`,
    'service.update': `updated service ${name}`,
    'deployment.create': `deployed ${name}`,
    'service.deployed': `deployed ${name}`,
    'service.rollback.requested': `requested a rollback of ${name}`,
    'organization.member.role_changed': `changed the organization role of ${member}`,
    'account.password.changed': 'changed their password',
    'job.replacement_backoff.reset': `restarted ${name} after a cooldown`,
    'project.access.team.granted': `granted team access to ${name}`,
    'project.access.user.granted': `granted user access to ${name}`,
    'project.access.team.revoked': `revoked team access to ${name}`,
    'project.access.user.revoked': `revoked user access to ${name}`,
  }
  const verbs: Record<string, string> = { create: 'created', created: 'created', update: 'updated', updated: 'updated', delete: 'deleted', deleted: 'deleted', revoke: 'revoked', revoked: 'revoked', rotated: 'rotated', restarted: 'restarted', removed: 'removed', accepted: 'accepted', granted: 'granted access to' }
  return sentences[action] ?? `${verbs[action.split('.').at(-1) ?? ''] ?? 'updated'} ${name}`
}
