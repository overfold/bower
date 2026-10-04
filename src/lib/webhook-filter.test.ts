import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { compileTagFilter, tagMatchesFilter } from './webhook-filter'

test('RE2 retains ordinary filter semantics and rejects incompatible existing filters', () => {
  assert.equal(tagMatchesFilter('^v[0-9]+\\.[0-9]+$', 'v12.3'), true)
  assert.equal(tagMatchesFilter('^v[0-9]+\\.[0-9]+$', 'v12.3-rc'), false)
  assert.equal(tagMatchesFilter('release', 'pre-release-7'), true)
  for (const pattern of ['a(?=b)', '(?<!x)a', '(a)\\1', '[', 'x'.repeat(513)]) {
    assert.throws(() => compileTagFilter(pattern))
    assert.equal(tagMatchesFilter(pattern, 'aa'), false)
  }
})

test('catastrophic JS backtracking inputs use linear matching, including maximum accepted input', () => {
  // A regression to native RegExp must fail by killing a child, not hang the
  // test runner's shared event loop (test timeout alone cannot interrupt JS).
  execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict'
    import { tagMatchesFilter } from './src/lib/webhook-filter.ts'
    for (const pattern of ['^(a+)+$', '^(a|aa)+$', '^(a*)*$']) {
      assert.equal(tagMatchesFilter(pattern, 'a'.repeat(1023) + '!'), false)
      assert.equal(tagMatchesFilter(pattern, 'a'.repeat(1024)), true)
    }
    assert.equal(tagMatchesFilter('.*', 'a'.repeat(1025)), false)
  `], { timeout: 5000 })
})
