import { statusLabel } from '@/lib/status'

const labels: Record<string, string> = {
  nonvoter: 'Non-voter', voter: 'Voter',
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
export const deploymentStatusLabels = Object.fromEntries(
  ['pending', 'planning', 'deploying', 'healthy', 'failed', 'rolled_back'].map((status) => [status, status === 'healthy' ? 'Succeeded' : statusLabel(status)]),
) as Record<string, string>
export const providerLabels = { generic: 'Generic', docker_hub: 'Docker Hub', ghcr: 'GitHub Container Registry' } as const
export const deployModeLabels = { any_push: 'Any push', tag: 'Tag', digest: 'Digest' } as const

export function label(value: string): string {
  return statusLabel(value) ?? labels[value] ?? (value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '))
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
    'account.password.changed': 'changed their password',
    'account.updated': 'updated their account',
    'allocation.stopped': `stopped allocation ${name}`,
    'allocation.terminal.opened': `opened a terminal for ${name}`,
    'api_key.created': `created API key ${name}`,
    'api_key.revoked': `revoked API key ${name}`,
    'deployment.auto_rollback': `automatically rolled back ${name}`,
    'deployment.manual': `deployed ${name} manually`,
    'deployment.promotion': `promoted ${name}`,
    'deployment.rollback': `rolled back ${name}`,
    'deployment.webhook': `deployed ${name} from a webhook`,
    'domain.created': `created domain ${name}`,
    'domain.deleted': `deleted domain ${name}`,
    'domain.verified': `verified domain ${name}`,
    'environment_variable.created': `created environment variable ${name}`,
    'environment_variable.deleted': `deleted environment variable ${name}`,
    'environment_variable.rotated': `rotated environment variable ${name}`,
    'environment_variables.updated': `updated environment variables for ${name}`,
    'invitation.accepted': `accepted invitation ${name}`,
    'invitation.created': `created invitation ${name}`,
    'invitation.revoked': `revoked invitation ${name}`,
    'node.drained': `drained node ${name}`,
    'node.undrained': `returned node ${name} to service`,
    'notification.created': `created notification channel ${name}`,
    'notification.deleted': `deleted notification channel ${name}`,
    'organization.member.removed': `removed ${member} from the organization`,
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
    'service.deleted': `deleted service ${name}`,
    'service.restarted': `restarted service ${name}`,
    'service.base_config.created': `created the base configuration for ${name}`,
    'service.base_config.updated': `updated the base configuration for ${name}`,
    'service.base_config.advanced_updated': `updated advanced base configuration for ${name}`,
    'service.config.updated': `updated configuration for ${name}`,
    'service.config.reset_to_base': `reset configuration for ${name} to the base`,
    'service.advanced.updated': `updated advanced configuration for ${name}`,
    'service.advanced.reset_to_base': `reset advanced configuration for ${name} to the base`,
    'service.environment_configuration.updated': `updated environment configuration for ${name}`,
    'service.volume_mounts.updated': `updated volume mounts for ${name}`,
    'deployment.create': `deployed ${name}`,
    'service.deployed': `deployed ${name}`,
    'service.rollback.requested': `requested a rollback of ${name}`,
    'organization.member.role_changed': `changed the organization role of ${member}`,
    'organization.updated': `updated organization ${name}`,
    'job.replacement_backoff.reset': `restarted ${name} after a cooldown`,
    'project.created': `created project ${name}`,
    'project.deleted': `deleted project ${name}`,
    'project.updated': `updated project ${name}`,
    'project.volume.saved': `saved volume ${name}`,
    'project.volume.deleted': `deleted volume ${name}`,
    'project.access.team.granted': `granted team access to ${name}`,
    'project.access.user.granted': `granted user access to ${name}`,
    'project.access.team.revoked': `revoked team access to ${name}`,
    'project.access.user.revoked': `revoked user access to ${name}`,
    'route.updated': `updated route ${name}`,
    'secret.rotated': `rotated secret ${name}`,
    'secret.deleted': `deleted secret ${name}`,
    'team.created': `created team ${name}`,
    'team.updated': `updated team ${name}`,
    'team.deleted': `deleted team ${name}`,
    'team.project.granted': `granted ${name} access to a project`,
    'team.project.revoked': `revoked ${name}'s project access`,
    'webhook.created': `created webhook ${name}`,
    'webhook.deleted': `deleted webhook ${name}`,
  }
  return sentences[action] ?? `${label(action.replaceAll('.', '_'))} · ${name}`
}
