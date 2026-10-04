# Tables and lists

Component specs: [Tables](../components/tables.md). This page covers how lists behave.

## Table or something else?

| Content | Use |
| --- | --- |
| Rows of comparable objects with several attributes | `Table` in a `Card` |
| A summary of one object | `KeyValue` grid |
| A handful of objects with one status each (Cluster card nodes, service tiles) | Compact rows or tiles in a card, each row navigable |
| Chronological events | `Timeline` |
| Activity feed | Two-line rows: an actor icon and sentence, then the mono action key and time |

Projects are a table, not cards (A3-L06).

## Columns

1. **The name comes first.** Then **Status**, directly after the name (A2-B10).
2. Then attributes, from most to least useful for scanning.
3. Then **Time**, right-aligned, then the actions column, then the chevron.
4. A column that would repeat the same value on every row is hidden. For example, Environment is hidden when there is only one (A1 P1-16). Routes hide the TLS column and show a chip only when TLS isn't automatic (A4-Q58).
5. Service-scoped tables never have a Service column (A4-F12).
6. Deployment tables use **one column order everywhere**: Service · Image · Status · Trigger · Duration · Time. Presets drop columns but never reorder them (A5-M8).

Header names: sentence-case nouns, rendered uppercase by `TableHead`. The time column is always **"Time"** (A4-Q49). The actions column header is visually hidden.

## Row navigation

If a row represents something with its own page, the **whole row navigates**, with a hover background, a trailing chevron, a link-styled primary name, Enter to open, and a real `<a>` on the name. See [Clickable rows](../components/tables.md#clickable-rows).

Rows that don't navigate have no hover background and no chevron.

## Toolbars: search and filters

Toolbars live **in the card header** (A3-L25, A5-M17):

```
[27 deployments]            [Search……………………] [All projects ▾] [All statuses ▾]
```

- The count is the card title: "27 deployments", "12 members", "1 event".
- `SearchInput` grows to fill the space (minimum 240px), with the placeholder "Search" and the scope in `aria-label` (A4-Q59).
- Filters are `Select`s with an "All …" first option. Use them for status, project, environment, role, team, actor, action, resource, and date (A3-L25).
- Show filters only when the list is long enough to need them: more than 8 projects (A3-L07), more than 10 members (A1 P1-11). Pages built for triage (Deployments, Audit log) always have them.
- Changing a filter resets to page 1.
- In project scope, drop organization-level filters (no project select) (A2-C3).

## Filtered-empty

When filters exclude everything, show an `EmptyState` inside the card: a specific title ("No deployments match these filters"), a short body, and **"Clear filters" as the primary action** (A3-C10). Don't offer an unrelated create action next to it.

## Pagination

Decided in A2-D4, A3-C23, and A5-H1:

```
1–20 of 27                                      ‹ Previous   Next ›
```

- A footer strip in the card: `border-t px-4 py-3 text-xs text-ink-muted`. The range is on the left, and small `ghost` buttons tinted `text-brand-700` are on the right. Disabled buttons are muted text with no box.
- The page size is 20.
- It is shown only when there is more than one page.
- Filtering and pagination run over the full returned history. There is no silent cap at 50 or 100 (A1 remediation notes).

## Preview lists (cards that show a subset)

- Show a fixed number of rows: Home deployments 8, Home activity 5, service Overview deployments 5 (A3-L04, A4-Q31, A5-M6).
- When rows are cut off, the footer reads "Showing 8 of 27" with "View all deployments →" (`PanelFooter`) (A5-V1).
- No footer when everything fits.
- The header count describes the whole set ("27 deployments").

## Activity rows (Home and Audit log)

- **Line 1:** an actor icon (person, system robot, API key, webhook), then a readable sentence: "Alex Morgan deployed Storefront v2.4.1" (A2-G1, A3-S14).
- **Line 2:** the raw action key in **mono**, then a middle dot, then the relative time: `service.deploy · just now` (A3-S15, A5-M7).
- Expanded audit details are a key and value grid. Changes render as `old → new`, with the old value muted and no quotes. Creates render `— → value`, and deletes render `value → —` (A3-S16, A5-C1).
- IDs in details are resolved to names (A5-L9).
- Read-only events (terminal opened, `.viewed`, `.read`) appear in the Audit log only, not on Home (`isHomeAuditEvent`) (A5-M7).

## Lists inside forms

- Choosing many from a few (teams in Invite people): a multi-select with chips (A3-C14).
- Granting access: a search field whose results appear as you type, in a bounded scroll area with a fade. People who already have access are hidden (A3-C15, A3-F15).
- Key and value editing: `KeyValueEditor` rows with inline validation and "Paste .env".
