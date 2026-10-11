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
  hint="Deployments across the organization, newest first."
  action={<Button size="sm" variant="primary"><Plus />New service</Button>}
/>
```

| Prop | Purpose |
| --- | --- |
| `title` | The card title, rendered as an `h2` by default (`as` changes the level). `text-tile font-semibold tracking-tight` (14px; R3/A2) |
| `hint` | Required description sentence under every card header, `text-xs text-ink-muted`. Say what the card holds in sentence case, about one line, ending with a period. A count alone does not qualify (R1) |
| `action` | Actions on the right: create and bulk actions, filters and search, a status chip. Stacks under the title below `sm` |

Layout: `min-h-[52px] px-4 py-3 border-b`.

### What goes in the header

Decided in A3-C03, A4-Q08, and A5-V1:

- **Title, description sentence, optional status, then actions.** Example: "Cluster" with an "All healthy" chip. Preview counts belong in the footer only (L10).
- **Create and bulk actions:** "+ New webhook", "+ Attach volume", "Grant access", "Paste .env".
- **Filter toolbars:** search plus filter selects, as on Deployments, Members, and Audit log (A5-M17).
- **Not** "View all" links. Those go in the footer.

### Under a tab's H2

When a tab page has an H2 (for example "Routes") and a single card under it, keep the **count title** and action ("2 routes" and "+ New route") and add a description sentence (R1; C13 rejected). On pages with several cards, each card keeps its own title and description, for example Configuration with General, Resources, Health checks, Variables, and Advanced. Do not remove repeating subtitles (M5 rejected).

## `CardTitle`, `CardDescription`

`CardTitle` matches the 14px title style. `CardDescription` (`text-xs text-ink-muted`) wraps to its own line. Use the `CardHeader` prop form to enforce the description; convert hand-written headers rather than bypassing it (R1).

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
- While a value is loading, keep the `Skeleton` bar (A3-C21). CPU awaiting its second sample has footer "Across N tasks · Sampling" ("task" at 1), not a sampled timestamp (T3). Once available, use "Across N tasks · Sampled …"; times under about 10s read "just now" (T2/C9).
- Usage tiles emphasize "0.2 cores" at tile size with smaller muted " of 0.5 cores" (A4). Allocation meters use brand below 85%, warn from 85%, danger from 100% (A6).
- Home deployments show a count plus smaller muted "deployments · 68% succeeded". Allocation subtitles wrap rather than truncate (L7).
- Header-less tiles are fine (CPU usage and Memory usage on the service Overview). Lists below them get a real card header (A5-M1 / Q56–57).

## Danger zone card

A card with `border-danger-200` whose title is "Danger zone" in `text-danger-500`, plus a description sentence (R1). It is always the **last** section on the page. Each destructive row has consequence text on the left and a `danger` button on the right, wrapping on narrow screens; project, member, and team use the same layout (C21). See [Destructive actions](../patterns/destructive-actions.md#danger-zone).

## Don't

- Add `shadow-card` or any shadow to cards.
- Put a table inside `CardContent`, which would inset it.
- Put "View all" in the header.
- Show two primary buttons in one card.
- Stack two headings: an H2 for the section and a card title with the same words.
