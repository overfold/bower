# Tables

Sources: `src/components/ui/table.tsx`, `src/components/clickable-table-row.tsx`, `src/components/deployments-table.tsx`, `src/components/ui/row-actions.tsx`. Contracts: `src/lib/ui-contracts.test.ts`.

For column order, filters, pagination, and other list rules, see [Tables and lists](../patterns/tables-and-lists.md).

## `Table` and its parts

| Part | Style |
| --- | --- |
| `Table` | `w-full border-collapse text-left` inside a horizontally scrolling wrapper (`overflow-x-auto scroll-thin scroll-horizontal`, with edge shadows on the card surface) |
| `TableHead` | `bg-sunken px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted`, with `scope="col"` |
| `TableRow` | `border-b border-line`. With `interactive`: `cursor-pointer hover:bg-sunken` |
| `TableCell` | `px-4 py-3 align-middle text-sm text-ink-soft` |
| `TableFooter` | `border-t bg-sunken font-medium` |
| `TableCaption` | `text-sm text-ink-muted` |

Behavior built into the wrapper (A5-H7):
- It becomes focusable (`tabIndex=0`, `role="region"`) **only when it overflows**, and it is labelled by the nearest card title (`aria-labelledby`), or by `<caption>`.
- It has a focus ring (inset `brand-500`).

`minWidth="md"` opts a table into a 640px minimum width, so it scrolls inside its card instead of crushing its columns. Use it for the full deployment history tables. Most tables shouldn't need it (A1 P0-04).

Place tables **directly** inside a `Card`, edge to edge, usually after a `CardHeader`.

## Cell conventions

| Content | Treatment |
| --- | --- |
| Primary name | `font-medium text-ink`. Styled as a link (`text-link`) when the row navigates |
| Secondary line under a name | `mt-0.5 text-2xs text-ink-muted` (or `font-mono text-xs` for an ID) |
| Copyable value | `Mono` / `font-mono` |
| Status | `StatusDot` / `DeploymentStatus` chip, in its own column **directly after the name** (A2-B9, A2-B10) |
| Time | `<Time>` relative, `text-ink-muted`, right-aligned, `whitespace-nowrap`. The column header is **"Time"** (A4-Q49) |
| Counts | Bare numbers (`2`, not `2 routes`), right-aligned or in a narrow column (A4-Q22) |
| Empty value | `—` |
| Static attributes (role, environment, protection) | Plain text, not chips (A1 P2-20) |
| Long text | `truncate` with a `title` tooltip, inside a `min-w-0` or `max-w-*` wrapper |

## Clickable rows

When a row opens a detail page (A3-N21, A3 B62):

1. The **whole row** is clickable, with a hover background (`TableRow interactive`).
2. The row is focusable, with `role="link"` and an `aria-label` ("View Storefront deployment"), and opens on Enter.
3. The **primary name is a real `<Link>`** styled with `text-link`. Clicking it stops propagation, which keeps middle-click and "open in new tab" working.
4. The last cell is a **chevron** (`ChevronRight`, `ml-auto size-4 text-ink-faint`, `aria-hidden`).
5. Interactive children (buttons, menus, inputs) don't trigger row navigation.

Use `ClickableTableRow href label` for generic tables. `DeploymentsTable` implements the same contract itself.

## Row actions

Decided in A2-D1, A3-C01, A3-C02, A4-Q56, and A4-Q57.

| Row has | Use |
| --- | --- |
| No actions | Nothing |
| **One** action | A single `IconButton` (for example trash or ↺ roll back) with a label or tooltip. A destructive single action is **neutral until hover**, then red |
| **Two or more** actions | `RowActions`: a `⋯` `IconButton` labelled "Actions for {name}" that opens a dropdown menu |

```tsx
<RowActions name={team.name}>
  <RowActionItem onSelect={rename}>Rename</RowActionItem>
  <RowActionSeparator />
  <RowActionItem className="text-danger-500" onSelect={confirmDelete}>Delete team</RowActionItem>
</RowActions>
```

- Menu items are neutral. The destructive item comes last, after a separator, in red text, and **always opens a confirmation** (A2-H5).
- The actions column header is **visually hidden**: `<TableHead><span className="sr-only">Actions</span></TableHead>`.
- On a row with both `⋯` and a chevron, `⋯` sits in the cell **directly before** the chevron, right-aligned (A4-Q57).
- Node actions (Drain node, Resume scheduling) live in the `⋯` menu (A3-L16, A4-Q12).

## `DeploymentsTable`

**Every list of deployments uses this component.** It has six presets with fixed column sets. Presets drop columns but never reorder them (A5-M8). The contract test asserts each set.

| Preset | Columns | Used on |
| --- | --- | --- |
| `organization` | Service (project beneath) · Image · Status · Trigger · Duration · Time · › | Deployments page |
| `project` | Service · Image · Status · Trigger · Duration · Time · › | Project › Deployments |
| `home` | Service · Image · Status · Time · › | Home (8 rows) |
| `compact` | Service · Image · Status · Time · › | Project Overview |
| `service-compact` | Image · Status · Time · › | Service Overview (5 latest) |
| `service-history` | Rev · Image · Status · Trigger · Duration · Time · Actions · › | Service › Deployments |

Cell rules:
- **Image:** the tag on top in mono (`from → to` in full presets when it changed, with the old tag muted). The repository goes beneath in muted `text-2xs` mono (A5-M8 / Q03). Compact presets show the target tag only (A4-Q05).
- **Status:** `DeploymentStatus` (Succeeded, Failed, In progress, Rolled back). Never live health (A3 B01).
- **Trigger:** icon plus label, with the actor beneath (A3-C26). Manual, Webhook, Promotion, Rollback, Auto-rollback.
- **Duration:** `1m 30s` (`formatDeploymentDuration`).
- **Rev:** blank when unknown. **Keep the revision column** in service history (A4-Q47, A6 review of A5-M8).
- **Actions** (history only): a single ↺ icon button "Roll back to this release" on eligible rows only (A4-Q48).

If a new screen needs a different column set, add a named preset and a contract test. Don't add props that toggle individual columns.

## Don't

- Hand-roll a deployments table or a row-click handler.
- Give columns visible "ACTIONS" headers.
- Put a red "Delete" button in every row (A2-H5).
- Let tables force the page to scroll horizontally.
- Mix relative and absolute times in one column (A2-M20).
