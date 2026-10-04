import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeploymentsTable, type DeploymentsTablePreset } from '../components/deployments-table'
import { allocationStatus, Meter, StatusDot } from '../components/status'
import { Checkbox } from '../components/ui/checkbox'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { PageHeading } from '../components/page-heading'
import { PanelFooter } from '../components/ui/panel'
import { statusDefinition } from './status'

test('shared status vocabulary keeps product labels, tones, and progress semantics together', () => {
  for (const [status, label, tone, inProgress = false] of [
    ['healthy', 'Healthy', 'success'],
    ['down', 'Failing', 'danger'],
    ['deploying', 'Deploying', 'neutral', true],
    ['never', 'Not deployed', 'neutral'],
    ['succeeded', 'Succeeded', 'success'],
    ['failed', 'Failed', 'danger'],
    ['rolled_back', 'Rolled back', 'info'],
    ['draining', 'Draining', 'warn'],
    ['unhealthy', 'Unhealthy', 'danger'],
    ['backoff', 'Restart pending', 'warn'],
  ] as const) {
    assert.deepEqual(statusDefinition(status), { label, tone, ...(inProgress ? { inProgress } : {}) })
    const html = renderToStaticMarkup(createElement(StatusDot, { status }))
    assert.match(html, new RegExp(`>${label.replace(' ', '.*')}<`))
    assert.equal(html.includes('animate-spin'), inProgress)
  }
})

test('allocation status distinguishes failures from intentional stops', () => {
  assert.equal(allocationStatus('failed'), 'failing')
  assert.equal(allocationStatus('lost'), 'failing')
  assert.equal(allocationStatus('stopped'), 'stopped')
  assert.equal(allocationStatus('completed'), 'completed')
})

test('meters warn at 85%, become dangerous at 100%, and render zero fill', () => {
  assert.match(renderToStaticMarkup(createElement(Meter, { value: 85 })), /bg-warn-500/)
  assert.match(renderToStaticMarkup(createElement(Meter, { value: 100 })), /bg-danger-500/)
  assert.match(renderToStaticMarkup(createElement(Meter, { value: 0 })), /width:0%/)
})

test('controls use the radius scale, strong borders, and invalid focus overrides', () => {
  const input = renderToStaticMarkup(createElement(Input, { 'aria-invalid': true }))
  const textarea = renderToStaticMarkup(createElement(Textarea, { 'aria-invalid': true }))
  for (const html of [input, textarea]) {
    assert.match(html, /rounded-lg/)
    assert.match(html, /border-line-strong/)
    assert.match(html, /focus-visible:ring-\[3px\]/)
    assert.match(html, /focus-visible:border-brand-500/)
    assert.match(html, /aria-\[invalid=true\]:focus-visible:border-danger-500/)
    assert.match(html, /aria-\[invalid=true\]:focus-visible:ring-danger-200/)
  }
  const checkbox = renderToStaticMarkup(createElement(Checkbox))
  assert.match(checkbox, /rounded-sm/)
  assert.match(checkbox, /border-line-strong/)
})

test('shared controls and headings preserve disabled and type scale contracts', () => {
  const button = renderToStaticMarkup(createElement(Button, { disabled: true }, 'Save'))
  assert.match(button, /disabled:border-line/)
  assert.match(button, /disabled:bg-sunken/)
  assert.doesNotMatch(button, /disabled:opacity/)

  const headings = (['h1', 'h2', 'h3'] as const).map((as) =>
    renderToStaticMarkup(createElement(PageHeading, { as, title: as })),
  )
  assert.match(headings[0], /text-2xl.*font-bold/)
  assert.match(headings[1], /text-lg.*font-semibold/)
  assert.match(headings[2], /text-sm.*font-semibold/)
})

test('DeploymentsTable presets retain their intended column contracts', () => {
  const row = {
    deployment: { id: 'dep-1', status: 'succeeded', triggerType: 'manual', imageAfter: 'app:v2', imageBefore: 'app:v1', createdAt: new Date('2026-10-02T12:00:00Z'), startedAt: new Date('2026-10-02T12:00:00Z'), completedAt: new Date('2026-10-02T12:01:30Z') },
    serviceName: 'Storefront', serviceSlug: 'storefront', projectName: 'Commerce', projectSlug: 'commerce', revision: 2,
  }
  const headers = (preset: DeploymentsTablePreset) => [...renderToStaticMarkup(createElement(DeploymentsTable, { rows: [row], preset })).matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((match) => match[1].replace(/<[^>]+>/g, ''))
  for (const preset of ['organization', 'project'] as const) {
    assert.deepEqual(headers(preset), ['Service', 'Image', 'Status', 'Trigger', 'Duration', 'Time', 'Open'])
  }
  for (const preset of ['home', 'compact'] as const) assert.deepEqual(headers(preset), ['Service', 'Image', 'Status', 'Time', 'Open'])
  assert.deepEqual(headers('service-compact'), ['Image', 'Status', 'Time', 'Open'])
  assert.deepEqual(headers('service-history'), ['Rev', 'Image', 'Status', 'Trigger', 'Duration', 'Time', 'Actions', 'Open'])
  const compactHtml = renderToStaticMarkup(createElement(DeploymentsTable, { rows: [row], preset: 'compact' }))
  assert.match(compactHtml, /title="app:v2">v2<\/span><span[^>]+>app<\/span>/)
  assert.doesNotMatch(compactHtml, /app:v1|Commerce|min-w-\[640px\]/)
  for (const preset of ['organization', 'project', 'home', 'service-history'] as const) {
    const html = renderToStaticMarkup(createElement(DeploymentsTable, { rows: [{ ...row, rollbackAction: createElement('button', null, 'Roll back') }], preset }))
    const cells = [...html.matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map((match) => match[1])
    assert.match(cells.at(-1)!, /lucide-chevron-right/)
    assert.match(cells.at(-1)!, /ml-auto/)
    if (preset === 'service-history') {
      assert.match(cells.at(-2)!, /<button>Roll back<\/button>/)
      assert.doesNotMatch(cells.at(-2)!, /lucide-chevron-right/)
    }
  }
})

test('preview footers appear only for omitted rows except cluster detail', () => {
  const render = (shown: number, total: number, always = false) => renderToStaticMarkup(PanelFooter({ shown, total, always, href: '/deployments', children: 'View all deployments' }))
  assert.equal(render(0, 0), '')
  assert.equal(render(5, 5), '')
  assert.match(render(5, 6), /Showing 5 of 6/)
  assert.match(render(5, 6), /View all deployments →/)
  assert.match(render(3, 3, true), /Showing 3 of 3/)
})

test('the notifications button names its unread count and caps the visible badge', async () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test'
  const { NotificationsMenu } = await import('../components/notifications-menu')
  const feed = (unreadCount: number) => ({ items: [], unreadCount, lastSeenAt: '2026-10-04T08:00:00.000Z' })

  const read = renderToStaticMarkup(createElement(NotificationsMenu, { initial: feed(0) }))
  assert.match(read, /aria-label="Notifications"/)
  assert.match(read, /aria-haspopup="menu"/)
  assert.ok(!read.includes('bg-brand-500'), 'no badge without unread items')

  const some = renderToStaticMarkup(createElement(NotificationsMenu, { initial: feed(3) }))
  assert.match(some, /aria-label="Notifications, 3 unread"/)
  assert.match(some, /<span aria-hidden="true"[^>]*>3<\/span>/)

  const many = renderToStaticMarkup(createElement(NotificationsMenu, { initial: feed(12) }))
  assert.match(many, /aria-label="Notifications, 12 unread"/)
  assert.match(many, />9\+<\/span>/)
  assert.match(many, /focus-visible:ring-2/)
})
