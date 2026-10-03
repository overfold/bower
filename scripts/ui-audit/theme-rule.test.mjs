import assert from 'node:assert/strict'
import test from 'node:test'
import { ESLint } from 'eslint'

const eslint = new ESLint()
const messages = async (source) => (await eslint.lintText(source, { filePath: 'src/components/theme-rule-fixture.tsx' }))[0].messages.filter((message) => message.ruleId === 'bower/named-type-scale')

test('color rule rejects undeclared tokens including variants and templates', async () => {
  const result = await messages('export const classes = `bg-surface-raised hover:text-made-up ring-offset-missing border-l-missing ${true ? "bg-line" : "bg-sunken"}`')
  assert.equal(result.length, 4)
  assert.ok(result.every((message) => message.messageId === 'color'))
})

test('color rule accepts theme colors, intrinsic colors and non-color utilities', async () => {
  assert.deepEqual(await messages('export const classes = "bg-line text-xs text-link hover:bg-ink/5 border-b-0 ring-offset-2 ring-offset-surface shadow-pop text-center bg-white border-l-transparent"'), [])
})
