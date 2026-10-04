# Typography

## Typefaces

| Family | Token | Loaded in | Use |
| --- | --- | --- | --- |
| **Inter** | `font-sans` (body default) | `src/app/layout.tsx` via `next/font/google` (`--font-inter`) | All prose, labels, headings, buttons, navigation, names |
| **JetBrains Mono** | `font-mono` | `src/app/layout.tsx` (`--font-jetbrains`) | Values people copy (see [the monospace rule](#the-monospace-rule)), logs, terminal |

`body` sets `font-sans antialiased`. Don't load other fonts.

## Type scale

The scale is declared in `@theme` in `globals.css`. Always use these names.

| Utility | Size | Line height | Typical use |
| --- | --- | --- | --- |
| `text-2xs` | 11px | 16px | Chips, table column headers, tab count pills, secondary lines in table cells, avatar initials, timeline times |
| `text-xs` | 12px | Tailwind default | Field hints and errors, card header hints, metadata, stat labels, footers ("Showing 8 of 27"), toolbar text |
| `text-sm` | 13px | Tailwind default | **Body text.** Controls, buttons, table cells, card titles, labels, nav items, descriptions |
| `text-code` | 12.5px | — | Monospace values. Applied automatically by `.font-mono` |
| `text-tile` | 14px | — | Titles of clickable tiles and list items (for example the project Overview service tiles) |
| `text-md` | 15px | — | Dialog and alert-dialog titles |
| `text-lg` | 18px | — | Section headings (H2): `PageHeading as="h2"`, `SectionTitle`. Wordmark text |
| `text-xl` | 22px | — | Not-found and error-boundary titles |
| `text-2xl` | 26px | — | Page titles (H1). Stat values on Home, Status, and allocation metrics |

> **Enforced.** `bower/named-type-scale` rejects `text-[Npx]` and auto-fixes it to the nearest name (11 → `2xs`, 12 → `xs`, 12.5–14 → `sm`, 15 → `md`, 17–18 → `lg`, 22 → `xl`, 24–26 → `2xl`). Don't add new `text-[…]` sizes. If a new step is truly needed, add it to `@theme` and to this table.

## Weights and tracking

| Weight | Use |
| --- | --- |
| `font-bold` (700) | Page H1 only (`PageHeading`) and the wordmark |
| `font-semibold` (600) | H2 and H3, card and dialog titles, stat values, chip-like counts, overline labels, table headers |
| `font-medium` (500) | Buttons, nav items, labels, tab labels, the primary name in a table row, list and tile titles, key facts in `MetaItem` |
| `font-normal` (400) | Body text, cell values, hints |

| Tracking | Use |
| --- | --- |
| `tracking-tightest` (−0.035em) | H1 and the wordmark only |
| `tracking-tight` | H2, card titles, dialog titles, stat values |
| `tracking-wide` | Table headers (uppercase) |
| `.overline` (0.05em) | Section labels (uppercase) |
| `tracking-normal` | Chips. Set explicitly so a chip placed beside an H1 doesn't inherit the tight tracking (A5-H4) |

## Heading hierarchy

Decided in A4-Q20 and enforced by the `PageHeading` contract test.

| Level | Style | Component | Where |
| --- | --- | --- | --- |
| H1, page | `text-2xl font-bold tracking-tightest` | `PageHeading` (default `as="h1"`) | One per page: the entity or page name |
| H2, section | `text-lg font-semibold tracking-tight` | `PageHeading as="h2"` or `SectionTitle` | The tab section under page tabs, settings section titles, major page sections |
| H3, card | `text-sm font-semibold tracking-tight` | `CardHeader title`, `CardTitle`, `PageHeading as="h3"` | Card and panel titles |
| Item | `text-sm` or `text-tile`, `font-medium` | — | List, tile, and timeline item titles. Never larger than the card title above them |
| Dialog | `text-md font-semibold tracking-tight` | `DialogTitle` and `AlertDialogTitle` | Dialog headers |

Rules:
- Headings are sentence case ("Audit log", "Recent deployments").
- **Titles are always sans**, even when the title is an identifier such as `storefront-alloc-1` or `node-eu-west-01` (A3-U06). Put the copyable mono ID in the meta row beneath.
- Never put a chip *inside* a heading element. Use the `status` slot of `PageHeading`, which places it beside the heading (A5-H4).
- The heading levels follow the document outline. A card under an H2 uses an H3, and a card directly under the H1 can be an H2 (`CardHeader as`).

## Section labels (overline)

`.overline` in `globals.css`: 11px, weight 600, uppercase, 0.05em letter spacing, `ink-muted`. It also resets the Tailwind `overline` text decoration.

Use it for group labels such as the sidebar groups ("Workspace", "Recent projects", "Platform"), the settings navigation groups, field groups inside long dialogs ("Destination", "Security", with a divider above), and the "Details" label in expanded audit rows. There is exactly one overline style. Don't recreate it with utilities.

## Text color hierarchy

| Token | For |
| --- | --- |
| `text-ink` | Headings, values, primary names |
| `text-ink-soft` | Body copy, cell text (the `TableCell` default), descriptions under page titles |
| `text-ink-muted` | Hints, metadata, timestamps, column headers, placeholders, disabled text |
| `text-link` | Links |
| `text-danger-500` | Field errors, the Danger zone title |

`text-ink-faint` is not a text color (linted).

## The monospace rule

**Use mono for anything a person might copy, and nothing else** (A2-A7, A3-T11, A3-U06).

Mono: image references and tags, hostnames, URLs, environment-variable keys, IDs, allocation and node IDs, paths, IP addresses, ports in technical contexts, versions shown as data, action keys (`service.deploy`), slugs in "Type `commerce` to confirm", log lines, the terminal.

Sans: names (project, service, team, and person display names), labels, counts, roles, statuses, titles, and headings, **even when they contain an identifier**.

Size: `.font-mono` forces `font-size: var(--text-code)` (12.5px) **everywhere**, so mono values have one size even inside 12px meta lines (A5 "Mono size" kept). Use `Mono` from `components/status.tsx` (mono + `ink-soft`), `ResourceId`, or `Input mono` rather than raw classes where possible.

## Numerals

- Add `.nums` (`font-variant-numeric: tabular-nums`) wherever numbers are compared vertically or update live: stat values, meter percentages, durations, tab counts, table number columns.
- Right-align numeric and time columns in tables.

## Line length and wrapping

- Descriptions under page titles cap at `max-w-2xl` (inside `PageHeading`). Empty-state bodies cap at `max-w-sm`.
- Long names use `break-words` in headings, and `truncate` with a `title` tooltip in table cells and breadcrumbs.
- Chips never wrap (`whitespace-nowrap`).
