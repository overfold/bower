# Page structure

Every page uses one of a few anatomies. Picking the right one is most of the layout work.

## Common anatomy

```
Breadcrumbs (header bar)                       ← the way back; ends at the entity
┌─────────────────────────────────────────────────────────────────┐
│ H1 Title  [Status chip] [Other chips]           [Secondary] [Primary] │ ← PageHeading
│ Description (only if informative)                                │
│ meta · meta · meta                                               │
├─────────────────────────────────────────────────────────────────┤
│ Overview  Services (3)  Deployments  …                           │ ← page tabs (entities only)
├─────────────────────────────────────────────────────────────────┤
│ H2 = exact tab label                                             │ ← PageHeading as="h2"
│ ┌ Card ───────────────────────────────────────────────────────┐ │
│ │ Title / count                          [filters] [+ Action] │ │
│ │ …                                                           │ │
│ │ Showing 8 of 27                     View all deployments →  │ │
│ └─────────────────────────────────────────────────────────────┘ │
```

Rules that apply to every page:

1. **One H1** per page, sentence case, sans (even for identifiers).
2. **The status chip comes right after the H1**, in the `status` slot. Never under the title, and never with a "Status:" label (A4-Q21).
3. **Descriptions only where they inform**: permissions combining, storage being pinned to a node, domain verification. Drop descriptions that restate the title (A3-S21, A3-U04).
4. **Actions sit top-right**, aligned with the top of the title, with at most one primary (A3 B40, B53).
5. **No back links.** The breadcrumb is the way back (A1 P1-12).
6. **Content order:** what needs attention, then the summary, then the details, then the history. The Danger zone always comes last.

## List pages

Projects, Deployments, Audit log, and the Status sections.

- `PageHeading` (title and description), then **one card** with a toolbar header: count, search, filters. Then the table, then pagination.
- Projects is a table: Project, Health ("Healthy" or "1 of 3 failing"), Services, Routes, Last deploy, and a chevron. The search box appears only above 8 projects (A3-L06, L07, B35).
- An empty or filtered-empty list renders an `EmptyState` **inside** the card (see [Empty states](empty-loading-and-error-states.md#empty-states)).

## Entity pages

### Project

- **Header:** title, a health chip ("1 of 3 failing" or "Healthy"), the description, then tabs. There is no meta row (A3-N18, U05).
- **Tabs, in a fixed order:** Overview · Services · Deployments · Routes · Environment · Settings (A3-N08, N09). Services shows a count when greater than 0.
- **Overview:** the Needs-attention table for this project, then a health strip with one clickable tile per service, then Recent deployments (`compact`) beside Routes (A3-L08). An empty project shows **one setup checklist card** instead: ① Create a service (primary), ② Deploy it, ③ Add a route. Later steps unlock in order and say why they are locked (A3-L09).
- **Settings:** one page with sections (General · Access · Integrations · Volumes · Danger zone), a sticky anchor `SubNav` on the left from `lg`, and the Danger zone **last** (A4-Q26, Q27). Old per-section URLs redirect to the anchors.

### Service

- **Header:** the name (H1), the live status chip (interactive when failing), the "Undeployed changes" chip when relevant, then a meta row: image (mono, copyable), "2/2 ready", and the primary route hostname with an external-link icon (A2-C3, A3-F04).
- **Actions:** Roll back… (default), Restart (default), Deploy (primary). Deploy is highlighted while there are undeployed changes.
- **Tabs:** Overview · Configuration · Mounts · Deployments. Advanced was folded into Configuration as a collapsed section, and `/advanced` redirects to it (A4-Q30).
- **Overview:** CPU and Memory usage tiles (usage against limit, with meters), then "Current allocations" (a card header with a count), then Recent deployments (`service-compact`, 5 rows, with a footer link). No log tail (A3-L20, A4-Q31).
- The header and tabs live in the shared layout, so they persist while a tab loads (A2-H3).

### Allocation

It has its own header, not nested under the service header (A3-N12):

- **Title:** the allocation name in sans, with its status chip. Meta: a service link, the node, and a copyable ID. Actions: Terminal and Stop.
- **Tabs (underline):** Logs · Details · Lifecycle (A3-N13, A4-Q24). Logs fill the viewport with a sticky toolbar: task select, Follow and Wrap switches, search with a match count, copy and download (A5-M18).
- **Breadcrumb:** Projects › Project › Service › allocation. There is no "Allocations" crumb.
- System allocations (for example `bower-proxy`) open a **read-only** allocation page (A5-M5).

### Node

- **Title:** the node name in sans, with a status chip (Healthy, Draining, Drained, or Unhealthy). Actions are in the `⋯` menu (A3-L16).
- **Sections:** Details (including capabilities), Capacity (an allocated bar with usage drawn over it, per resource, "allocatable 7.5 of 8 cores"), and **Allocations on this node** (A3-L15, L17, L18, A5-M5).
- Heartbeat appears **once** ("Last heartbeat 12s ago"), with a chip only when it is stale (A5-M5).

### Deployment

- **Above the title:** the service as a link.
- **Title:** the image reference in sans (`storefront:v2.4.1`), with a status chip. Meta: "Oct 2, 23:05 · Webhook" (A3-N15, B42).
- **Failed:** a compact danger notice under the header with the failure message, the failing allocation's last log lines, and "Open allocation" (A3 B23, A4-Q45). The primary action is "Roll back to {last good}" (see [Deployments and recovery](deployments-and-recovery.md)).
- **Superseded:** a neutral notice, "Superseded by v2.4.1 · succeeded 1h ago · View", and no primary action (A5-C3).
- **Summary:** Image, Strategy, Duration, and Revision in a 3-column `KeyValue` grid, with the image spanning the row. **Events** use a `Timeline` with details collapsed.

## Tab sections

- Each tab page starts with an **H2 that is exactly the tab label** ("Deployments", not "Deployment history"; "Mounts", not "Volume mounts") (A4-Q25).
- If the tab holds a single list, the card header under the H2 shows only the **count and the action** ("2 routes", "+ New route") (A3 B53, A5-M1 / Q58).
- Long settings pages keep **both levels**: the section H2 and the card title (General › Project details) (A5 / Q59).

A6 rejected an attempt to strip these headings further (A5-M1), so this structure stays.

## Settings pages

- Layout (`src/app/(dashboard)/settings/layout.tsx`): a **"Settings" H1** above a two-column grid, with the grouped `SubNav` (180px) on the left and content on the right (A2-C4, C5).
- Groups and their order: **Personal** › Account · **Instance** › Organizations (instance admins only) · **Organization** › Organization, Members, Teams, Domains (A3-N06, A3 B27).
- Each page's section title (H2) is exactly its nav label, and so is its breadcrumb.
- Settings › Organization combines General and the Trellis connection (`#connection`). `/settings/cluster` redirects there (A3-F11, A4-Q28).
- Settings › Account holds Profile, Password (its own "Update password" button), API keys, and Appearance (theme select) (A3-F10, A4-Q38).
- Pages and tables are full width. Individual fields are capped (see [Form widths](../foundations/spacing-and-layout.md#form-widths)).
- Detail pages: **Team** (members table with Add member, a project access table, Rename in the header, Delete in the Danger zone) and **Member** (Details card, a Roles card with organization role and, for instance admins, instance role selects and one Save, then a Danger zone with "Remove from organization") (A2-C14, A3-F12, A5-M11).

## Home

1. "Home" H1. No greeting and no summary sentence (A3-N16).
2. **Needs attention** table, hidden when empty (A3-L02, A4-Q01, Q02).
3. **Stats strip:** Allocation health · CPU allocated · Memory allocated · Deployments over 14 days (thin stacked bars on a baseline, sentence-case legend) (A3-L03, A4-Q07).
4. **Recent deployments** (`home` preset, 8 rows, with a footer link), beside **Cluster** (node rows with chips, a status chip in the header, and an always-visible "View cluster status →") and **Recent activity** (5 rows, with actor icons and the action key in mono) (A3-L04, L05, A5-M6, M7).
