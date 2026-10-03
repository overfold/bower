import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DiffColumns } from '../app/(dashboard)/audit/audit-log-list'

const render = (details: Record<string, unknown>) => renderToStaticMarkup(React.createElement(DiffColumns, { details }))

test('create renders each field with a muted empty old value', () => {
  const html = render({ before: null, after: { name: 'Storefront', image: 'acme/web:v2' } })
  assert.match(html, />Name<\/dt>/)
  assert.match(html, />Image<\/dt>/)
  assert.equal((html.match(/class="text-ink-muted">—<\/span>/g) ?? []).length, 2)
  assert.match(html, /class="text-ink">Storefront<\/span>/)
  assert.match(html, /class="text-ink">acme\/web:v2<\/span>/)
  assert.doesNotMatch(html, /\[object Object\]|>Change<\/dt>/)
})

test('update renders only changed fields, preserving nested values and zero', () => {
  const html = render({ before: { name: 'Storefront', replicas: 2, settings: { port: 80 } }, after: { name: 'Storefront', replicas: 0, settings: { port: 8080 } } })
  assert.doesNotMatch(html, />Name<\/dt>/)
  assert.match(html, /class="text-ink-muted">2<\/span>/)
  assert.match(html, /class="text-ink">0<\/span>/)
  assert.match(html, /port&quot;:80}/)
  assert.match(html, /port&quot;:8080}/)
})

test('delete renders old values to an empty new value', () => {
  const html = render({ before: { name: 'Worker', replicas: 3 }, after: null })
  assert.match(html, /class="text-ink-muted">Worker<\/span>/)
  assert.match(html, /class="text-ink-muted">3<\/span>/)
  assert.equal((html.match(/class="text-ink">—<\/span>/g) ?? []).length, 2)
  assert.doesNotMatch(html, /\[object Object\]/)
})

test('scalar diffs still render false and zero rather than empty values', () => {
  const html = render({ before: false, after: 0 })
  assert.match(html, />Change<\/dt>/)
  assert.match(html, /class="text-ink-muted">false<\/span>/)
  assert.match(html, /<\/span>0<\/dd>/)
})
