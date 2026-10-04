# Contributing to the design system

This is how to change Bower's UI without causing drift. It applies to people and coding agents alike, and builds on the repository rules in [`AGENTS.md`](../../../AGENTS.md).

## Before you change a screen

1. **Find a comparable screen** that already works the way you need, and the shared components it uses. Use the [component inventory](../components/README.md).
2. **Read the relevant pattern page.** Most questions (where an action goes, what a status is called, how a form saves) are already answered.
3. **Check the [decision log](../records/decision-log.md)** if you are about to change something that looks deliberate. It probably is. If you disagree with a decision, raise it. Don't quietly reverse it.

## Change shared behavior at its source

| If you need to change… | Change… | Not… |
| --- | --- | --- |
| A color, radius, shadow, font size, or easing | `src/app/globals.css` (`:root` and `@theme`) | A `bg-[#…]` or `text-[13px]` on the page |
| How a control looks or behaves | The primitive in `src/components/ui/` | `className` overrides on one page |
| A status label or tone | `src/lib/status.ts` | A local map or a conditional class |
| An enum's display text | `src/lib/labels.ts` | Inline strings |
| A time, unit, or number format | `src/lib/format.ts` | `toLocaleString`, local helpers |
| Deployment table columns | A preset in `DeploymentsTable` | A new table |
| A breadcrumb label | `src/lib/breadcrumbs.ts` | The header bar |

When you change a primitive, **check its consumers** (`grep -r "from '@/components/ui/<name>'" src`). Then update the contract test, this guide, and the [changelog](../changelog.md) in the same change.

`className` on a primitive is for **layout** (width, margin, grid placement), and occasionally for one documented exception. It's not for restyling the primitive's core look.

## What the tooling enforces

| Check | Where | Catches |
| --- | --- | --- |
| `bower/named-type-scale` | `eslint.config.mjs` | `text-[Npx]` (auto-fixes to the named scale). Color utilities whose token isn't in `@theme` |
| `bower/no-low-contrast-focus` | `eslint.config.mjs` | `ring-brand-100` and `ring-brand-300`, and `focus:border-brand-300`, outside the complete field-focus recipe |
| `bower/no-faint-text` | `eslint.config.mjs` | `text-ink-faint` on text elements |
| UI contracts | `src/lib/ui-contracts.test.ts` | Status labels, tones, and spinners. Meter thresholds. Control radius, border, focus, and invalid styles. Disabled buttons. Heading scale. `DeploymentsTable` presets. `PanelFooter` visibility |
| Focused tests | `src/lib/*.test.ts` | Labels and audit sentences, formatting, breadcrumbs, button icon sizing, config diffs, releases, variables matrix, needs-attention selection |

Don't disable these rules to fit a design deviation (AGENTS.md). If a rule is wrong, fix the rule and record why.

### When to add a contract test

Add or extend a contract in `src/lib/ui-contracts.test.ts` when you:
- add or change a variant, size, or state of a primitive
- add a status, or change a label or tone
- add or change a `DeploymentsTable` preset or a similar column contract
- change a rule that other screens rely on, such as footer visibility or meter thresholds

Test **behavior and contracts** (rendered labels, classes that carry meaning, column headers), not whole-markup snapshots.

## Verify

Run the checks that fit the change (from [AGENTS.md › Verification](../../../AGENTS.md#verification)):

```bash
npm run lint                                   # design-system lint rules
npx tsc --noEmit
node --import tsx --test src/lib/ui-contracts.test.ts
npm test                                       # full suite
git diff --check
```

**For visual changes, a passing build is not verification.** Also:

- Render representative states: **desktop and narrow (390px)**, **light and dark**, and **loading, empty, error, disabled, and open-dialog** where they apply.
- Exercise changed interactions with the keyboard and check names in the accessibility tree.
- For broad changes, run the [UI capture workflow](visual-verification.md) and compare against the previous gallery.

## Review checklist

Use this list when reviewing UI changes, your own included.

**Tokens and foundations**
- [ ] Only declared tokens. No hex values, default Tailwind palette, `dark:` variants, or `opacity-*` for disabled states.
- [ ] Named type sizes. Sans for prose, mono only for copyable values, titles in sans.
- [ ] `ink-faint` is not used for text. Secondary text is `ink-muted`.
- [ ] The radius matches the element (control 8, card 12, chip 6, checkbox 4). Cards have no shadow.

**Components**
- [ ] Existing primitives and product components are used, not hand-styled replacements.
- [ ] Status comes from `StatusDot` / `DeploymentStatus` / `AllocationStatus`. There is no local status map.
- [ ] Static attributes are plain text, not chips.
- [ ] Dialogs use `size`, have a title, and focus the first field.
- [ ] Every time is a `<Time>`, and every ID is a `ResourceId` or `Mono`.

**Patterns**
- [ ] At most one primary per card, dialog, or header. `danger` opens a destructive flow and `destructive` confirms it.
- [ ] Verbs follow New/Create, Add/Attach, Delete, Remove, Revoke. "+" appears only on create and attach triggers.
- [ ] Forms validate on submit, inline, and focus the first error. Drafts use `UnsavedChangesBar`.
- [ ] Rows that navigate are fully clickable, with a chevron and a link-styled name. Row actions follow one icon or `⋯`.
- [ ] Every data surface handles empty, loading, and error states. Filtered-empty states offer "Clear filters".
- [ ] Copy is in sentence case, uses the glossary terms, and pluralizes correctly.

**Accessibility and responsiveness**
- [ ] Visible focus on everything interactive. The whole change works by keyboard.
- [ ] Labels for every control, `aria-label` for icon-only controls, hidden headers for actions columns.
- [ ] Status isn't conveyed by color alone.
- [ ] No page-level horizontal scroll at 390px. Tables and tabs scroll locally. Long names truncate with a `title`.
- [ ] Reduced motion is respected.

**Safety and authorization**
- [ ] Destructive actions have the right friction level (see [Destructive actions](../patterns/destructive-actions.md)).
- [ ] Hidden or disabled actions are also rejected server-side, and mutations record audit entries.

**Documentation**
- [ ] The guide pages for anything you changed are updated.
- [ ] There is a [changelog](../changelog.md) entry for design-system changes.
- [ ] New decisions are in the [decision log](../records/decision-log.md). New gaps are in [known issues](../records/known-issues.md).

## Recording decisions and audits

- **A decision** (a choice between reasonable options): add a row to the [decision log](../records/decision-log.md) with an ID, the decision, and its source. Mark what it supersedes.
- **An audit** (a review that produces findings): add `records/audits/audit-NN.md` using the existing audits as the template. Then update the [records index](../records/README.md), and fold any resulting decisions into the decision log.
- **Then update the guide** so it describes the result. The guide states rules, and the records explain them.
