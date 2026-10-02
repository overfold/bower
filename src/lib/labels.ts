const labels: Record<string, string> = {
  rolled_back: 'Rolled back', 'rolled-back': 'Rolled back',
  never: 'Not deployed', nonvoter: 'Non-voter', voter: 'Voter',
  fresh: 'Fresh', stale: 'Stale', auto: 'Automatic', none: 'Public',
  instance_admin: 'Instance admin', user: 'User', admin: 'Admin',
}

export const roleLabels = { viewer: 'Viewer', deployer: 'Deployer', admin: 'Admin', owner: 'Owner', member: 'Member' } as const
export const organizationRoleLabels = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const
export const instanceRoleLabels = { admin: 'Instance admin', user: 'User' } as const
export const tlsLabels = { auto: 'Automatic HTTPS', custom: 'Custom certificate', none: 'HTTP only' } as const
export const protectionLabels = { none: 'Public', password: 'Password protected', bower_auth: 'Bower account' } as const
export const heartbeatLabels = { fresh: 'Fresh', stale: 'Stale', never: 'Never' } as const
export const deploymentStrategyLabels = { rolling: 'Rolling', recreate: 'Recreate', blue_green: 'Blue/green', canary: 'Canary' } as const
export const deploymentTriggerLabels = { manual: 'Manual', webhook: 'Webhook', promotion: 'Promotion', rollback: 'Rollback', auto_rollback: 'Automatic rollback' } as const
export const deploymentStatusLabels = { pending: 'Pending', planning: 'Planning', deploying: 'Deploying', healthy: 'Healthy', failed: 'Failed', rolled_back: 'Rolled back' } as const
export const providerLabels = { generic: 'Generic', docker_hub: 'Docker Hub', ghcr: 'GitHub Container Registry' } as const
export const deployModeLabels = { any_push: 'Any push', tag: 'Tag', digest: 'Digest' } as const

export function label(value: string): string {
  return labels[value] ?? (value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '))
}
