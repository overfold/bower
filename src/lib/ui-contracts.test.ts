import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
import { createToastStore, InlineNotice, PageBanner, PageBannerView, ToastViewport, TOAST_DURATION_MS, TOAST_EXIT_MS, TOAST_LIMIT, useFeedback, type ToastEntry } from '../components/ui/feedback'
import { statusDefinition } from './status'
import { NeedsAttention } from '../components/needs-attention'
import { ServiceFailureNotice } from '../components/service-failure-notice'
import { LastDeployFailed } from '../components/last-deploy-failed'
import { ConfigDiffPreview } from '../components/config-diff-preview'
import { TimeSeriesChart } from '../components/ui/time-series-chart'
import { niceCeil, seriesGeometry, seriesRuns, summarizeSeries } from './time-series'
import { formatCpu } from './format'

test('shared status vocabulary keeps product labels, tones, and progress semantics together', () => {
  for (const [status, label, tone, inProgress = false] of [
    ['healthy', 'Healthy', 'success'],
    ['down', 'Failing', 'danger'],
    ['deploying', 'Deploying', 'neutral', true],
    ['never', 'Not deployed', 'neutral'],
    ['succeeded', 'Succeeded', 'success'],
    ['failed', 'Failed', 'danger'],
    ['rolled_back', 'Rolled back', 'warn'],
    ['lost', 'Lost', 'danger'],
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
  assert.equal(allocationStatus('failed'), 'failed')
  assert.equal(allocationStatus('dead'), 'failed')
  assert.equal(allocationStatus('lost'), 'lost')
  assert.equal(allocationStatus('running', 'unhealthy'), 'unhealthy')
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

test('danger toasts persist until dismissed, other tones auto-dismiss after their exit animation', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const store = createToastStore()
  const state = () => store.getSnapshot().map((toast) => `${toast.title}${toast.closing ? ' (closing)' : ''}`)
  store.push({ tone: 'success', title: 'Logs copied' })
  const danger = store.push({ tone: 'danger', title: 'Could not roll back' })

  t.mock.timers.tick(TOAST_DURATION_MS - 1)
  assert.deepEqual(state(), ['Logs copied', 'Could not roll back'])
  t.mock.timers.tick(1)
  assert.deepEqual(state(), ['Logs copied (closing)', 'Could not roll back'])
  t.mock.timers.tick(TOAST_EXIT_MS)
  assert.deepEqual(state(), ['Could not roll back'])

  t.mock.timers.tick(10 * 60_000)
  assert.deepEqual(state(), ['Could not roll back'])
  store.dismiss(danger)
  assert.deepEqual(state(), ['Could not roll back (closing)'])
  t.mock.timers.tick(TOAST_EXIT_MS)
  assert.deepEqual(state(), [])
})

test('hovering or focusing the toast stack pauses auto-dismiss and resumes with the remaining time', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const store = createToastStore()
  store.push({ tone: 'success', title: 'Password updated' })
  t.mock.timers.tick(3000)
  store.setPaused(true)
  t.mock.timers.tick(60_000)
  assert.equal(store.getSnapshot()[0].closing, false)

  // A toast that arrives while paused waits too.
  store.push({ tone: 'info', title: 'Rollback started' })
  t.mock.timers.tick(60_000)
  assert.deepEqual(store.getSnapshot().map((toast) => toast.closing), [false, false])

  store.setPaused(false)
  t.mock.timers.tick(TOAST_DURATION_MS - 3000 - 1)
  assert.deepEqual(store.getSnapshot().map((toast) => toast.closing), [false, false])
  t.mock.timers.tick(1)
  assert.deepEqual(store.getSnapshot().map((toast) => toast.closing), [true, false])
  t.mock.timers.tick(3000)
  assert.deepEqual(store.getSnapshot().map((toast) => toast.title), ['Rollback started'])
  assert.equal(store.getSnapshot()[0].closing, true)
})

test('toasts cap the visible stack, skip the exit under reduced motion, and clear timers on teardown', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const store = createToastStore()
  for (let index = 1; index <= TOAST_LIMIT + 2; index++) store.push({ tone: 'success', title: `Saved ${index}` })
  assert.deepEqual(store.getSnapshot().map((toast) => toast.title), ['Saved 3', 'Saved 4', 'Saved 5', 'Saved 6'])

  const reduced = createToastStore({ reducedMotion: () => true })
  const id = reduced.push({ tone: 'danger', title: 'Restart failed' })
  reduced.dismiss(id)
  assert.deepEqual(reduced.getSnapshot(), [])

  let notified = 0
  store.subscribe(() => { notified++ })
  store.destroy()
  t.mock.timers.tick(TOAST_DURATION_MS * 2)
  assert.equal(notified, 0)
  assert.equal(store.getSnapshot().length, TOAST_LIMIT)
})

test('toasts render in sibling polite and assertive regions with no nested live roles', () => {
  const toast = (tone: ToastEntry['tone'], title: string, description?: string): ToastEntry => ({ id: title, tone, title, description, closing: false })
  const empty = renderToStaticMarkup(createElement(ToastViewport, { toasts: [], onDismiss() {} }))
  assert.match(empty, /^<section aria-label="Status messages"[^>]*><div aria-live="polite"[^>]*><\/div><div aria-live="assertive"[^>]*><\/div><\/section>$/)

  const html = renderToStaticMarkup(createElement(ToastViewport, {
    toasts: [toast('success', 'Logs copied'), toast('danger', 'Could not roll back', 'The rollback could not be started.'), toast('info', 'Rollback started')],
    onDismiss() {},
  }))
  assert.equal(html.match(/aria-live=/g)?.length, 2)
  assert.doesNotMatch(html, /role="(alert|status)"/)
  const polite = html.slice(html.indexOf('aria-live="polite"'), html.indexOf('aria-live="assertive"'))
  const assertive = html.slice(html.indexOf('aria-live="assertive"'))
  // The polite region is closed before the assertive one opens: siblings, not nested.
  assert.equal(polite.match(/<div/g)?.length, polite.match(/<\/div>/g)?.length)
  assert.match(polite, /Logs copied[\s\S]*Rollback started/)
  assert.doesNotMatch(polite, /Could not roll back/)
  assert.match(assertive, /Could not roll back[\s\S]*The rollback could not be started\./)

  // Neutral surface, tone on the icon only.
  assert.match(html, /border-line bg-surface/)
  assert.doesNotMatch(html, /bg-(ok|danger|info)-50/)
  assert.match(html, /class="lucide lucide-circle-check [^"]*text-ok-500"/)
  assert.match(html, /class="lucide lucide-circle-alert [^"]*text-danger-500"/)
  assert.match(html, /class="lucide lucide-info [^"]*text-info-500"/)
  for (const title of ['Logs copied', 'Could not roll back', 'Rollback started']) {
    assert.match(html, new RegExp(`<button type="button"[^>]*aria-label="Dismiss: ${title}"`))
  }
  assert.doesNotMatch(html, /black\/5/)
})

test('feedback tones are the shared Tone names, without error or warning aliases', () => {
  // Type-level contract, checked by `npx tsc --noEmit`; never executed.
  void (() => {
    // @ts-expect-error 'error' is not a tone; use 'danger'.
    InlineNotice({ tone: 'error', children: 'Failed' })
    // @ts-expect-error 'warning' is not a tone; use 'warn'.
    createElement(PageBanner, { tone: 'warning', title: 'Trellis is unavailable.' })
    // @ts-expect-error 'error' is not a tone; use 'danger'.
    useFeedback().toast({ tone: 'error', title: 'Restart failed' })
  })
  // InlineNotice keeps its tinted, in-flow style.
  assert.match(renderToStaticMarkup(InlineNotice({ tone: 'danger', children: 'Failed' })), /bg-danger-50 text-danger-500" role="alert"/)
  assert.match(renderToStaticMarkup(InlineNotice({ tone: 'warn', children: 'Careful' })), /bg-warn-50/)
})

test('page banners are not dismissible by default and require an id to become dismissible', () => {
  const plain = renderToStaticMarkup(createElement(PageBanner, { title: 'Trellis is unavailable.' }, 'Connection refused.'))
  assert.match(plain, /Trellis is unavailable\./)
  assert.match(plain, /bg-warn-50/)
  assert.doesNotMatch(plain, /<button/)

  void (() => {
    // @ts-expect-error A dismissible banner needs an explicit id.
    createElement(PageBanner, { dismissible: true, title: 'Maintenance tonight' })
  })
  const withoutId = renderToStaticMarkup(createElement(PageBanner, { dismissible: true, title: 'Maintenance tonight' } as never))
  assert.match(withoutId, /Maintenance tonight/)
  assert.doesNotMatch(withoutId, /<button/)

  // The server can't see sessionStorage, so a dismissible banner renders nothing
  // there (and during hydration) rather than painting and then disappearing.
  assert.equal(renderToStaticMarkup(createElement(PageBanner, { dismissible: true, id: 'maintenance', title: 'Maintenance tonight' })), '')

  const dismissible = renderToStaticMarkup(createElement(PageBannerView, { title: 'Maintenance tonight', onDismiss() {} }))
  assert.match(dismissible, /<button type="button"[^>]*aria-label="Dismiss: Maintenance tonight"/)
  assert.match(dismissible, /hover:bg-ink\/5/)
  assert.doesNotMatch(dismissible, /black\/5/)
})

test('page banner actions render beside the text, not inside the sentence', () => {
  const html = renderToStaticMarkup(createElement(PageBanner, {
    title: 'Trellis is unavailable.',
    action: createElement('button', { type: 'button' }, 'Retry connection'),
  }, 'Connection refused.'))
  const text = html.match(/<div class="min-w-0"><span class="font-semibold">Trellis is unavailable\.<\/span><span class="ml-1">Connection refused\.<\/span><\/div>/)
  assert.ok(text, html)
  const after = html.slice(text.index! + text[0].length)
  assert.match(after, /^<div class="flex shrink-0[^"]*"><button type="button">Retry connection<\/button><\/div>/)
  // The text and action share a row that stacks on narrow screens.
  assert.match(html, /flex-col[^"]*sm:flex-row[^"]*"><div class="min-w-0">/)
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

test('deployment lists show unknown durations as a dash, never blame System for a manual deploy, and keep failure reasons out of the row', () => {
  const base = { deployment: { id: 'dep', status: 'failed', triggerType: 'manual', imageAfter: 'app:v2', createdAt: new Date('2026-10-02T12:00:00Z'), startedAt: new Date('2026-10-02T12:00:00Z'), completedAt: new Date('2026-10-02T12:00:00Z') }, serviceName: 'Storefront', serviceSlug: 'storefront', projectName: 'Commerce', projectSlug: 'commerce' }
  const html = renderToStaticMarkup(createElement(DeploymentsTable, { preset: 'project', rows: [{ ...base, userName: null, failureMessage: 'Image pull failed' }] }))
  assert.match(html, />—<\/td>/)
  assert.doesNotMatch(html, />0s</)
  assert.match(html, /Unknown user/)
  assert.doesNotMatch(html, />System</)
  // The reason is reachable as a tooltip; it never makes history rows taller.
  assert.match(html, /title="Image pull failed"/)
  assert.doesNotMatch(html, /<p[^>]*>Image pull failed/)
  const history = renderToStaticMarkup(createElement(DeploymentsTable, { preset: 'service-history', rows: [{ ...base, userName: 'Ada', revision: null }, { ...base, deployment: { ...base.deployment, id: 'dep-2' }, userName: 'Ada', revision: 4, version: 9 }] }))
  assert.match(history, /Trellis never accepted this release/)
  assert.match(history, /title="Trellis revision 4, job version 9"/)
  assert.doesNotMatch(history, />v9</)
})

test('Needs attention shows one row per service with a since column and a single action', () => {
  const html = renderToStaticMarkup(createElement(NeedsAttention, { rows: [{
    id: 'service-worker', status: 'failing', serviceName: 'Order Worker', specificId: 'alloc-2', cause: 'Worker could not reach database',
    since: '2026-10-02T11:00:00Z', href: '/projects/commerce/services/worker/allocations/alloc-2', action: 'View logs', severity: 0,
  }, { id: 'deployment-dep', status: 'rolled_back', serviceName: 'Web', cause: 'Rolled back automatically: deadline elapsed', since: '2026-10-02T10:00:00Z', href: '/projects/commerce/deployments/dep', action: 'View diagnostics', severity: 2 }] }))
  assert.match(html, />Since</)
  assert.doesNotMatch(html, /Failing since|Last failure/)
  assert.match(html, />View logs</)
  assert.match(html, /Rolled back/)
  assert.equal(html.match(/Order Worker/g)?.length, 1)
  assert.equal(html.match(/<a /g)?.length, 2)
})

test('the failing service notice leads with the cause and keeps logs one click away', () => {
  const html = renderToStaticMarkup(createElement(ServiceFailureNotice, { logsHref: '/logs', failure: { cause: 'Worker could not reach database', failures: 4, kind: 'restart_backoff', failingSince: '2026-10-02T11:00:00Z', nextAttemptAt: '2099-01-01T00:00:00Z' } }))
  assert.match(html, /Restart pending/)
  assert.match(html, /Worker could not reach database/)
  assert.match(html, /href="\/logs"/)
  assert.match(html, /role="alert"/)
  assert.match(renderToStaticMarkup(createElement(ServiceFailureNotice, { failure: { cause: 'Awaiting placement: insufficient cpu', kind: 'unplaceable' }, logsHref: '/a' })), /View allocation/)
})

test('the last-deploy marker distinguishes a rollback from a failure', () => {
  assert.match(renderToStaticMarkup(createElement(LastDeployFailed, { href: '/d', outcome: 'rolled_back' })), /Last deploy rolled back/)
  assert.match(renderToStaticMarkup(createElement(LastDeployFailed, { href: '/d' })), /Last deploy failed/)
})

test('the config diff shows plain environment values, masks secrets, and marks unrecorded values', () => {
  const html = renderToStaticMarkup(createElement(ConfigDiffPreview, { afterLabel: 'Selected release', changes: [
    { kind: 'config', key: 'cpu', label: 'CPU', before: 500, after: null, afterRecorded: false },
    { kind: 'config', key: 'health', label: 'Health check', before: null, after: null },
    { kind: 'environment', key: 'env.PORT', label: 'Environment', variable: 'PORT', change: 'Changed', before: { present: true, masked: false, value: '8080' }, after: { present: true, masked: false, value: '9090' } },
    { kind: 'environment', key: 'env.TOKEN', label: 'Environment', variable: 'TOKEN', change: 'Removed', before: { present: true, masked: true }, after: { present: false, masked: false } },
  ] }))
  assert.match(html, />8080</)
  assert.match(html, />9090</)
  assert.match(html, /••••••••/)
  assert.match(html, /Not recorded/)
  assert.match(html, />None</)
  // The chip follows the variable name instead of sitting above it.
  assert.ok(html.indexOf('>PORT<') < html.indexOf('>Changed<'))
  // The table keeps its bordered, rounded frame inside the dialog body.
  assert.match(html, /overflow-hidden rounded-md border border-line/)
})

const chartPoints = (values: Array<number | null>) => values.map((value, index) => ({ t: Date.UTC(2026, 9, 7, 12, index), value, peak: value === null ? null : value * 1.5 }))
const renderChart = (props: Partial<Parameters<typeof TimeSeriesChart>[0]> & { values?: Array<number | null> }) => {
  const { values = [100, 200, null, null, 300, 400, null, 500], ...rest } = props
  return renderToStaticMarkup(createElement(TimeSeriesChart, { label: 'CPU usage', rangeLabel: 'last hour', points: chartPoints(values), formatValue: formatCpu, ...rest }))
}

test('time series gaps break the line instead of interpolating, and a lone sample still draws', () => {
  assert.deepEqual(seriesRuns(chartPoints([1, 2, null, null, 3, null, 4])), [{ start: 0, end: 1 }, { start: 4, end: 4 }, { start: 6, end: 6 }])
  assert.deepEqual(seriesRuns(chartPoints([null, null])), [])
  const { line, area } = seriesGeometry(chartPoints([100, 200, null, 300, 400]), 400)
  assert.equal(line, 'M0 75 L250 50 M750 25 L1000 0')
  assert.equal(line.match(/M/g)?.length, 2)
  assert.equal(area.match(/Z/g)?.length, 2)
  assert.match(seriesGeometry(chartPoints([null, 100, null]), 100).line, /^M500 0 h0$/)
  const html = renderChart({})
  const path = html.match(/<path d="(M[^"]+)" fill="none"/)?.[1] ?? ''
  assert.equal(path.match(/M/g)?.length, 3, 'two nulls and a trailing null produce three separate runs')
  assert.equal(path, 'M0 80 L142.86 60 M571.43 40 L714.29 20 M1000 0 h0', 'each run is its own subpath; nothing joins across a null')
})

test('time series axis ends on a readable value that includes the limit', () => {
  for (const [value, expected] of [[0, 1], [0.7, 1], [130, 200], [230, 250], [480, 500], [501, 1000]] as const) assert.equal(niceCeil(value), expected)
  // Binary quantities count in their largest reached unit, so the axis reads 1 GB rather than 953.7 MB.
  const [MB, GB] = [1048576, 1073741824]
  assert.equal(niceCeil(GB * 0.9, [MB, GB]), 1000 * MB)
  assert.equal(niceCeil(GB, [MB, GB]), GB)
  assert.equal(niceCeil(GB * 1.2, [MB, GB]), GB * 2)
  assert.equal(niceCeil(300 * MB, [MB, GB]), 500 * MB)
  assert.equal(niceCeil(1150, [1, 1000]), 2000)
  assert.equal(niceCeil(480, [1, 1000]), 500)
  const html = renderChart({ values: [100, 200], limit: 1000, limitLabel: 'CPU limit' })
  assert.match(html, />1 core</)
  assert.match(html, /CPU limit/)
})

test('time series exposes an accessible summary, a keyboard-focusable plot, and a readout', () => {
  const html = renderChart({ limit: 450, limitLabel: 'CPU limit' })
  const label = html.match(/role="group" tabindex="0" aria-label="([^"]+)"/)?.[1]
  assert.equal(label, 'CPU usage over the last hour: latest 0.5 cores, lowest 0.1 cores, highest 0.5 cores, 2 gaps without data, cpu limit 0.45 cores, exceeded.')
  assert.match(html, /aria-describedby="[^"]+"/)
  assert.match(html, /aria-live="off"/)
  assert.match(html, /Latest/)
  assert.equal(summarizeSeries({ label: 'Memory usage', rangeLabel: 'last 6 hours', points: chartPoints([null, null]), format: String }), 'Memory usage over the last 6 hours: no samples yet.')
  assert.doesNotMatch(summarizeSeries({ label: 'x', rangeLabel: 'y', points: chartPoints([1, 2]), format: String, limit: 5 }), /gap|exceeded/)
})

test('time series uses semantic tokens only and respects reduced motion', () => {
  const ok = renderChart({ limit: 1000 })
  assert.match(ok, /stroke-brand-500/)
  assert.match(ok, /stroke-line/)
  assert.match(ok, /stroke-warn-500/)
  assert.doesNotMatch(ok, /stroke-danger-500/)
  assert.match(renderChart({ limit: 300 }), /stroke-danger-500/)
  const source = readFileSync(resolve('src/components/ui/time-series-chart.tsx'), 'utf8')
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|\brgb\(|\bhsl\(|text-\[\d/i)
  for (const line of source.split('\n').filter((text) => /\btransition-/.test(text))) assert.match(line, /motion-reduce:transition-none/)
})

test('time series loading, empty and error states keep the plot height', () => {
  const loading = renderChart({ state: 'loading', points: [] })
  assert.match(loading, /role="status"/)
  assert.match(loading, /animate-pulse[^"]*motion-reduce:animate-none/)
  assert.match(loading, /h-40/)
  const empty = renderChart({ values: [null, null, null] })
  assert.match(empty, /No samples yet/)
  assert.match(empty, /h-40/)
  assert.doesNotMatch(empty, /<svg/)
  const failed = renderChart({ state: 'error', error: 'Metrics history is unavailable.', onRetry: () => {} })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Metrics history is unavailable\./)
  assert.match(failed, />Retry</)
})
