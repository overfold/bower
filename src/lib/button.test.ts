import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from '../components/ui/button'
import { Trash2, RefreshCw } from 'lucide-react'

test('asChild buttons preserve a single slotted link', () => {
  const html = renderToStaticMarkup(createElement(Button, { asChild: true }, createElement('a', { href: '/projects' }, 'Projects')))
  assert.match(html, /^<a /)
  assert.match(html, /href="\/projects"/)
  assert.match(html, />Projects<\/a>$/)
  assert.doesNotMatch(html, /<button|<svg/)
})

test('busy buttons expose pending state with one decorative spinner', () => {
  const html = renderToStaticMarkup(createElement(Button, { 'aria-busy': true, disabled: true }, 'Saving…'))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /disabled=""/)
  assert.equal((html.match(/<svg/g) ?? []).length, 1)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /Saving…/)
})

test('Lucide class names containing h- do not evade the icon size rule', () => {
  for (const icon of [Trash2, RefreshCw]) {
    const html = renderToStaticMarkup(createElement(Button, {}, createElement(icon)))
    assert.ok(html.includes('[&amp;_svg]:size-4'))
    assert.ok(!html.includes('svg:not'))
  }
  const small = renderToStaticMarkup(createElement(Button, { size: 'sm' }, createElement(Trash2)))
  assert.ok(small.includes('[&amp;_svg]:size-3.5'))
})

test('loading disables a button without requiring callers to duplicate busy state', () => {
  const html = renderToStaticMarkup(createElement(Button, { loading: true }, 'Deploy'))
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-busy="true"/)
  assert.equal((html.match(/<svg/g) ?? []).length, 1)
})
