# Cards and panels

Sources: `src/components/ui/card.tsx`, `src/components/ui/panel.tsx`, `src/components/dashboard-stats-bar.tsx`.

`Panel` and `PanelHeader` are aliases of `Card` and `CardHeader`. Both names exist in the code, and they are the same component. There is one card API (A2-L4).

## `Card`

`min-w-0 overflow-hidden rounded-xl border border-line bg-surface`, with `data-slot="card"`.

- **Border only, no shadow** (A3-T08).
- `overflow-hidden` clips child tables and footers to the rounded corners (A1 P0-03). Overlays are portalled, so they aren't clipped.
- Cards hold related content that belongs together: one list, one form section, one summary. Don't nest cards.

## `CardHeader`

```tsx
<CardHeader
  title="Recent deployments"
  hint="27 deployments"
  action={<Button size="sm" variant="primary"><Plus />New service</Button>}
/>
```

| Prop | Purpose |
| --- | --- |
| `title` | The card title, rendered as an `h2` by default (`as` changes the level). `text-sm font-semibold tracking-tight` |
| `hint` | One line under the title, `text-xs text-ink-muted`. Usually a **count** ("27 deployments", "5 variables") or a short scope ("Image and deployment behavior") |
| `action` | Actions on the right: create and bulk actions, filters and search, a status chip. Stacks under the title below `sm` |
| `children` | For custom header content when `title` isn't used |

Layout: `min-h-[52px] px-4 py-3 border-b`.

### What goes in the header

Decided in A3-C03, A4-Q08, and A5-V1:

- **Title, then count and status, then actions.** Example: "Cluster" with an "All healthy" chip.
- **Create and bulk actions:** "+ New webhook", "+ Attach volume", "Grant access", "Paste .env".
- **Filter toolbars:** search plus filter selects, as on Deployments, Members, and Audit log (A5-M17).
- **Not** "View all" links. Those go in the footer.

### Under a tab's H2

When a tab page has an H2 (for example "Routes") and a single card under it, the card header shows only the **count and the action** ("2 routes" and "+ New route"), so the title isn't repeated (A3 B53, A3-N17). On pages with several cards, each card keeps its own title, for example Configuration with General, Resources, Health checks, Variables, and Advanced.

## `CardTitle`, `CardDescription`

For custom headers. `CardTitle` matches the `title` style. `CardDescription` (`text-xs text-ink-muted`) wraps to its own line.

## `CardContent`

`p-4`. Tables go **directly** in the card, edge to edge, without `CardContent` (A2-L6).

## `CardFooter`

`flex justify-end gap-2 border-t border-line bg-sunken px-4 py-3`. Use it for single-action forms ("Update password"), for summary rows, and as the base of `PanelFooter`.

## `PanelFooter`: preview cards

```tsx
<PanelFooter shown={rows.length} total={total} href="/deployments">View all deployments</PanelFooter>
```

Renders `Showing 8 of 27` on the left and a `text-link` "View all deployments →" on the right (A5-V1).

- It renders **only when rows are cut off** (`shown < total`), so it disappears when everything is visible.
- `always` forces it to show. Use it only when the link leads to *more detail* rather than more rows. The Home Cluster card always shows "View cluster status →".
- Name what the link opens: "View all deployments", "View all activity", not a bare "View all".

Contract: `src/lib/ui-contracts.test.ts` ("preview footers appear only for omitted rows except cluster detail").

## `KeyValue`

```tsx
<dl className="grid sm:grid-cols-3 gap-x-6">
  <KeyValue label="Strategy">Rolling</KeyValue>
  <KeyValue label="Image" mono>ghcr.io/acme/storefront:v2.4.1</KeyValue>
</dl>
```

A label (`text-xs text-ink-muted`) over a value (`text-sm text-ink`, truncating, `mono` for copyable values). Use it inside `<dl>` for summaries: node details, deployment summary (3 columns, with the image spanning the row) (A5-M2).

Show only facts that aren't already in the page header. The deployment summary shows Image, Strategy, Duration, and Revision, not Service, Trigger, or Started (A4-Q44).

## `SectionTitle`

An `h2` at `text-lg font-semibold tracking-tight`. Use it for section headings inside long pages (Project Settings: General, Access, Integrations, Volumes). For headings with description or actions, use `PageHeading as="h2"`.

## Stat tiles

`StatCell` in `dashboard-stats-bar.tsx`:

```
Label            text-xs font-medium text-ink-muted
20%              text-2xl font-semibold tracking-tight .nums
▬▬▬▬▬▬▬▬▬▬       optional full-width meter (h-1.5, line track, brand-500 fill)
4.5 cores / 22.5 detail, text-xs text-ink-muted, truncating
```

- Tiles sit in one card as a `grid gap-px bg-line` strip with 1px dividers (Home and the Status page share them, A5-M4).
- The meter goes **under** the value at full tile width (A3 B70).
- While a value is loading, show a `Skeleton` bar, not "Sampling…" or a muted dash (A3-C21). A live tile's footer reads "Updated 5s ago" (A5-C2).
- Header-less tiles are fine (CPU usage and Memory usage on the service Overview). Lists below them get a real card header (A5-M1 / Q56–57).

## Danger zone card

A card with `border-danger-200` whose title is "Danger zone" in `text-danger-500` (A3-S10, A5-M11). It is always the **last** section on the page (A4-Q26). It holds one row per destructive action: a sentence explaining the consequence, and a `danger` button. See [Destructive actions](../patterns/destructive-actions.md#danger-zone).

## Don't

- Add `shadow-card` or any shadow to cards.
- Put a table inside `CardContent`, which would inset it.
- Put "View all" in the header.
- Show two primary buttons in one card.
- Stack two headings: an H2 for the section and a card title with the same words.
