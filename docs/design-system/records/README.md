# Records: audits, findings, and decisions

This folder is the **history** behind the design system. It is kept separate from the guide on purpose:

- The **guide** (everything outside `records/`) says what to do now. Read it when you are building.
- The **records** say why things are the way they are, and what was considered and rejected. Read them when you want to change a rule, or when the guide's rule looks odd.

Records are not instructions. When a record and the guide disagree, the guide (and the code) wins. Fix the guide if the record reveals a mistake.

## Contents

| Record | What it is |
| --- | --- |
| [Decision log](decision-log.md) | **Start here.** Every decision currently in force, by topic, with its source and what it superseded |
| [Known issues](known-issues.md) | Current gaps between the guide and the code, dark-theme contrast failures, and open questions |
| [Prototype reference](prototype-reference.md) | What the original Magic Patterns prototype defined, and what Bower adopted, changed, or rejected |
| [Audits](#audits) | The six UI audit rounds: findings, decision forms, outcomes |

## Audits

All six rounds took place in October 2026. Each audit reviewed screenshots from the [UI capture workflow](../workflow/visual-verification.md) against the source, produced findings (and usually a decision questionnaire for the product owner), and was followed by an implementation commit. **Later audits override earlier ones.**

| # | Record | Findings | Decisions | Implemented in | Main outcomes |
| --- | --- | --- | --- | --- | --- |
| 1 | [Bower UI audit](audits/audit-01.md) | 69 (P0–P3) | Keep-or-adopt table, portal review | `eff167a` | Shared-component bug fixes, semantic tokens only, separate success green, one tone type, the named type scale (linted), `ResourceId`, `Time`, compact entity headers, save patterns, destructive variant |
| 2 | [Remediation review](audits/audit-02.md) | 46 | 69 (`A2-A1`–`H3`) | `a89b993` | Live health, accessible focus ring (linted), faint ink as non-text only (linted), `RowActions`, `UnsavedChangesBar`, `SearchInput`, Home renamed, settings side navigation, invite links only |
| 3 | [Questionnaire and fix list](audits/audit-03.md) | 73 (`B01`–`B73`) | 146 (`A3-T01`…, plus follow-ups) | `460ef29` | 4/6/8/12 radius, status vocabulary (`status.ts`), Failing / Succeeded / Restart pending, verbs, border-only cards, overline, the mono rule, local time, 6 project tabs, rollback picker, deploy diff, inline validation, one-time secrets |
| 4 | [Dashboard and interface review](audits/audit-04.md) | 48 | 70 (`A4-Q01`–`Q70`) | `26fb95f` | `brand-500` field focus, neutral disabled buttons, compact deployment presets, Needs-attention rules, Advanced folded into Configuration, the heading scale, chip after the H1, draft variables |
| 5 | [Interface review with triage](audits/audit-05.md) | 43 (+1 in round 6) | Accept or reject per finding, with embedded choices | `2c0185c` | The color-token lint, `tw-animate-css`, overflow-only table regions, palette ranking, superseded deployments, audit diffs for creates |
| 6 | [Deferred-item review](audits/audit-06.md) | 15 deferred + 1 new | 10 accepted, 4 changed, 1 rejected | `52d7c55` | One `SubNav`, `PanelFooter` continuation links, actor icons, joined hostname input, dialog scroll shadows, settled section headings |

The implementation commits were identified by matching each audit's distinctive changes (for example the lint rules and token edits it asked for) to the commit that introduced them.

## Conventions

- **IDs:** `A{n}-{id}` for decisions and items from audit *n* (`A3-T01`, `A4-Q17`, `A5-M12`). Audit 1 findings are `A1 P0-01`, and the audit 3 fix list is `A3 B01`. Audit 4 findings, which weren't numbered in the original, are `A4-F01`…, in report order.
- **Fixture artifacts:** each audit lists what it **excluded** because the seed data or the fake cluster caused it, so nobody "fixes" the UI for a fixture bug.
- **Answers are quoted verbatim** when they were free text, typos included.

## Adding a record

1. Copy the structure of the most recent audit: header table, summary, findings, decisions, kept, excluded.
2. Number it `audit-NN.md` and add it to the table above.
3. Fold each decision into the [decision log](decision-log.md). Update the superseded rows instead of adding conflicting ones.
4. Update the guide pages the decisions affect, and add a [changelog](../changelog.md) entry.
5. Move anything you find but don't fix into [known issues](known-issues.md).

## Legacy files

This folder replaces two earlier documents, whose content is preserved in the audit records:

- `docs/ui-audit-remediation.md` is now part of [audit 1](audits/audit-01.md).
- `docs/ui-fix-checklist.md` is now part of [audit 3](audits/audit-03.md) (the status column of the B01–B73 table).

`docs/ui-audit.md` (the capture workflow) moved to [workflow/visual-verification.md](../workflow/visual-verification.md).
