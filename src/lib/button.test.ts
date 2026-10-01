import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from '../components/ui/button'

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
