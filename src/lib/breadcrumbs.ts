export interface BreadcrumbData {
  projects: { name: string; slug: string }[]
  services: { name: string; slug: string; projectSlug: string }[]
  deploymentLabels: Record<string, string>
  memberLabels: Record<string, string>
  teamLabels: Record<string, string>
}

const segmentLabels: Record<string, string> = {
  dashboard: 'Home', projects: 'Projects', deployments: 'Deployments', status: 'Status',
  settings: 'Settings', audit: 'Audit log', organization: 'Organization', members: 'Members',
  teams: 'Teams', cluster: 'Organization', instance: 'Organizations', account: 'Account',
  services: 'Services', environment: 'Environment', secrets: 'Secrets', routes: 'Routes',
  integrations: 'Integrations', revisions: 'Deployments', allocations: 'Allocations',
  volumes: 'Volumes', advanced: 'Advanced', configuration: 'Configuration', access: 'Access',
  domains: 'Domains', mounts: 'Mounts',
}

export function deriveBreadcrumbs(pathname: string, data: BreadcrumbData): { label: string; href: string }[] {
  if (['/dashboard', '/projects', '/deployments', '/status', '/audit'].includes(pathname)) return []
  const raw = pathname.split('/').filter(Boolean)
  if (raw[0] === 'settings' && raw[1] === 'instance') {
    return [
      { label: 'Instance', href: '/settings/instance' },
      { label: 'Organizations', href: '/settings/instance' },
    ]
  }
  const serviceTabs = new Set(['revisions', 'advanced', 'configuration', 'mounts'])
  const segments = raw[0] === 'projects' && raw[2] === 'services' && serviceTabs.has(raw.at(-1) ?? '') ? raw.slice(0, -1) : raw
  if (!segments.length) return [{ label: 'Home', href: '/dashboard' }]
  return segments.flatMap((segment, index) => {
    // Structural route segments do not have index pages in detail breadcrumbs.
    if (segments[0] === 'projects' && ((segments.length > 3 && index === 2 && segment === 'services') || (index === 4 && segment === 'allocations'))) return []
    // /status/allocations has no index page (it would be read as a node id), so the segment is not a crumb.
    if (segments[0] === 'status' && index === 1 && segment === 'allocations' && segments.length > 2) return []
    const label = segments[0] === 'projects' && index === 1 ? data.projects.find((project) => project.slug === segment)?.name ?? decodeURIComponent(segment)
      : segments[0] === 'projects' && segments[2] === 'services' && index === 3 ? data.services.find((service) => service.projectSlug === segments[1] && service.slug === segment)?.name ?? 'Service'
      : segments[index - 1] === 'deployments' ? data.deploymentLabels[segment] ?? 'Deployment'
      : segments[0] === 'settings' && segments[1] === 'members' && index === 2 ? data.memberLabels[segment] ?? 'Member'
      : segments[0] === 'settings' && segments[1] === 'teams' && index === 2 ? data.teamLabels[segment] ?? 'Team'
      : segments[index - 1] === 'allocations' || (segments[0] === 'status' && index === 1) ? segment
      : segmentLabels[segment] ?? 'Page'
    return [{ label, href: '/' + segments.slice(0, index + 1).join('/') }]
  })
}
