import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NodeLink } from '@/components/node-link'

test('opaque node labels retain both ends without shortening their destination IDs', () => {
  const id = '89fdafd2-ad7e-4a8e-be74-2d9400e11837'
  const html = renderToStaticMarkup(createElement(NodeLink, { id }))
  assert.ok(html.includes(`href="/status/${id}"`))
  assert.ok(html.includes(`title="${id}"`))
  assert.match(html, />89fdaf…1837<\/span>/)
  assert.ok(!html.includes(`>${id}</a>`))
})

test('unassigned allocations do not link to a node and short identifiers remain intact', () => {
  const empty = renderToStaticMarkup(createElement(NodeLink, { id: '' }))
  assert.ok(!empty.includes('<a'))
  assert.ok(empty.includes('—'))
  const short = renderToStaticMarkup(createElement(NodeLink, { id: 'node-1' }))
  assert.match(short, />node-1<\/span>/)
})

test('human-readable node identifiers retain distinguishing suffixes', () => {
  for (const id of ['node-eu-west-01', 'node-eu-west-02']) {
    const html = renderToStaticMarkup(createElement(NodeLink, { id }))
    assert.ok(html.includes(`>${id}</span>`))
  }
})
