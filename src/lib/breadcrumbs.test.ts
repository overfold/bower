import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBreadcrumbs, type BreadcrumbData } from './breadcrumbs'

const data: BreadcrumbData = {
  projects: [{ slug: 'commerce', name: 'Commerce Platform' }],
  services: [{ slug: 'storefront', projectSlug: 'commerce', name: 'Storefront' }],
  deploymentLabels: { 'deployment-id': 'storefront:v2.4.1' },
  memberLabels: { 'member-id': 'Alex Morgan' },
  teamLabels: { 'team-id': 'Platform Engineering' },
}

test('all dynamic breadcrumb segments use the resource contract', () => {
  for (const [path, expected] of [
    ['/projects/commerce', ['Projects', 'Commerce Platform']],
    ['/projects/commerce/services/storefront', ['Projects', 'Commerce Platform', 'Storefront']],
    ['/projects/commerce/deployments/deployment-id', ['Projects', 'Commerce Platform', 'Deployments', 'storefront:v2.4.1']],
    ['/settings/members/member-id', ['Settings', 'Members', 'Alex Morgan']],
    ['/settings/teams/team-id', ['Settings', 'Teams', 'Platform Engineering']],
    ['/status/node-eu-west-01', ['Status', 'node-eu-west-01']],
    ['/projects/commerce/services/storefront/allocations/storefront-alloc-1', ['Projects', 'Commerce Platform', 'Storefront', 'storefront-alloc-1']],
  ] as const) assert.deepEqual(deriveBreadcrumbs(path, data).map((crumb) => crumb.label), expected)
  const allocation = deriveBreadcrumbs('/projects/commerce/services/storefront/allocations/storefront-alloc-1', data)
  assert.equal(allocation.at(-1)?.href, '/projects/commerce/services/storefront/allocations/storefront-alloc-1')
})

test('unknown IDs are never prettified and settings labels match navigation', () => {
  assert.equal(deriveBreadcrumbs('/settings/teams/8c20c9aa-7c83-41ff-b4d3-b45c23cc3ec2', data).at(-1)?.label, 'Team')
  assert.equal(deriveBreadcrumbs('/settings/members/unknown', data).at(-1)?.label, 'Member')
  assert.equal(deriveBreadcrumbs('/projects/unknown', data).at(-1)?.label, 'unknown')
  assert.equal(deriveBreadcrumbs('/projects/commerce/services/unknown', data).at(-1)?.label, 'Service')
  assert.equal(deriveBreadcrumbs('/projects/commerce/deployments/unknown', data).at(-1)?.label, 'Deployment')
  assert.deepEqual(deriveBreadcrumbs('/settings/instance', data).map((crumb) => crumb.label), ['Instance', 'Organizations'])
})

test('top-level pages leave the header to the organization switcher', () => {
  for (const page of ['dashboard', 'projects', 'deployments', 'status', 'audit']) {
    assert.deepEqual(deriveBreadcrumbs(`/${page}`, data), [])
  }
  assert.deepEqual(deriveBreadcrumbs('/settings/instance/new', data).map((crumb) => crumb.label), ['Instance', 'Organizations'])
})
