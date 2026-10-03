import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeploymentsTable, type DeploymentsTablePreset } from '../components/deployments-table'
import { StatusDot } from '../components/status'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
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

test('controls use the radius scale, strong borders, and invalid focus overrides', () => {
  const input = renderToStaticMarkup(createElement(Input, { 'aria-invalid': true }))
  const textarea = renderToStaticMarkup(createElement(Textarea, { 'aria-invalid': true }))
  for (const html of [input, textarea]) {
    assert.match(html, /rounded-lg/)
    assert.match(html, /border-line-strong/)
    assert.match(html, /focus-visible:ring-\[3px\]/)
    assert.match(html, /aria-\[invalid=true\]:focus-visible:border-danger-500/)
    assert.match(html, /aria-\[invalid=true\]:focus-visible:ring-danger-200/)
  }
  const checkbox = renderToStaticMarkup(createElement(Checkbox))
  assert.match(checkbox, /rounded-sm/)
  assert.match(checkbox, /border-line-strong/)
})

test('DeploymentsTable presets retain their intended column contracts', () => {
  const row = {
    deployment: { id: 'dep-1', status: 'succeeded', triggerType: 'manual', imageAfter: 'app:v2', imageBefore: 'app:v1', createdAt: new Date('2026-10-02T12:00:00Z'), startedAt: new Date('2026-10-02T12:00:00Z'), completedAt: new Date('2026-10-02T12:01:30Z') },
    serviceName: 'Storefront', serviceSlug: 'storefront', projectName: 'Commerce', projectSlug: 'commerce', revision: 2,
  }
  const headers = (preset: DeploymentsTablePreset) => [...renderToStaticMarkup(createElement(DeploymentsTable, { rows: [row], preset })).matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((match) => match[1].replace(/<[^>]+>/g, ''))
  for (const preset of ['organization', 'project', 'home'] as const) {
    assert.deepEqual(headers(preset), ['Service', 'Image', 'Trigger', 'Status', 'Duration', 'Started', 'Open'])
  }
  assert.deepEqual(headers('service-history'), ['Rev', 'Image', 'Status', 'Trigger', 'When', 'Roll back', 'Open'])
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
