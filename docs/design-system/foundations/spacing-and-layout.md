# Spacing and layout

Bower uses Tailwind's default 4px spacing scale. There are no custom spacing tokens. Consistency comes from a small set of repeated rhythms, listed below. Match them before you invent a new one.

## App shell

`src/app/(dashboard)/layout.tsx`

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ Sidebar      │ Header bar (sticky, h-14, canvas/85 + blur)          │
│ 236px, fixed │  [≡ drawer] Org picker › breadcrumbs …   [Search ⌘K] │
│ from lg      ├──────────────────────────────────────────────────────┤
│              │ <main id="main-content">                             │
│ surface      │   px-4 py-5 · sm:px-6 sm:py-6 · lg:px-8 lg:py-8      │
│              │   ┌── max-w-6xl (1152px), centered ───────────────┐  │
│              │   │ page                                          │  │
└──────────────┴──────────────────────────────────────────────────────┘
```

- **Sidebar:** fixed at 236px from `lg` (1024px). Below `lg` it moves into `MobileDrawer`, opened from the header.
- **Header bar:** `sticky top-0 z-20 h-14`, translucent canvas with `backdrop-blur-md`, `border-b border-line`.
- **Main:** `#main-content` is the skip-link target (`tabIndex={-1}`). While the unsaved-changes bar is visible, it gets `data-unsaved` and an extra `padding-bottom: 8rem`, so the floating bar never covers the last field.
- **Content column:** `mx-auto max-w-6xl`. All dashboard pages use the full column (A2-A10, A3-N07), and narrower widths are set **per control**, not per page (see [Form widths](#form-widths)).
- **Page transitions:** `PageTransition` fades in each route (see [Motion](motion.md)).

## Breakpoints

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

| Breakpoint | What changes |
| --- | --- |
| < `sm` | Single column. Header and dialog actions stack full width. Dialog footer buttons stack. `PageHeading` actions go below the title. Filter controls stack and grow to 40px tall |
| `sm` | Two-column form grids, horizontal card headers, dialog footer row |
| `md` | Settings layout gets its side navigation column (`md:grid-cols-[180px_minmax(0,1fr)]`) |
| `lg` | Fixed sidebar. Project Settings anchor navigation (`lg:grid-cols-[10rem_minmax(0,1fr)]`). Home's two-thirds and one-third columns |

The capture suite checks a 390 × 844 viewport as its narrow layout and 1440 × 1000 as desktop (see [Visual verification](../workflow/visual-verification.md)).

## Vertical rhythm

| Context | Spacing |
| --- | --- |
| Between major blocks on a page (heading, cards, sections) | `space-y-6` (24px). The most common page rhythm |
| Between long settings sections | `space-y-10`, each section separated by `border-t border-line pt-8` (Project Settings) |
| Page title to description | `mt-2`. Description to meta row: `mt-3` |
| Between fields in a form or dialog body | `space-y-4` (16px) |
| Inside a field (label, control, hint) | `space-y-2` (8px) |
| Between cards in a grid | `gap-4` to `gap-6` |
| Between buttons in a group | `gap-2` |
| Between a tab bar and the section H2 | The H2 directly follows the tab bar inside the page's `space-y-6` |

## Component padding

| Component | Padding |
| --- | --- |
| Card content (`CardContent`) | `p-4` |
| Card header (`CardHeader`) | `px-4 py-3`, `min-h-[52px]` |
| Card footer (`CardFooter`, `PanelFooter`) | `px-4 py-3`, `bg-sunken`, `border-t` |
| Table header cell | `px-4 py-2` |
| Table body cell | `px-4 py-3` (`px-3` in compact presets) |
| Dialog header and body | `px-4 py-4`, `sm:px-5` |
| Dialog footer | `px-4 py-3`, `sm:px-5`, `bg-sunken` |
| Inline notice | `px-3.5 py-3` |
| Toast | `p-4` |
| Empty state | `px-6 py-14` |
| Stat tile | `px-4 py-4`, `sm:px-5` |

## Grids

- **Forms:** `grid grid-cols-1 gap-4 sm:grid-cols-2` for paired fields (Replicas and Strategy, CPU and Memory, TLS and Rate limit). Rows of three use explicit ratios, for example a health check with Type, Path, and Port at `1 : 2 : 1` (A4-Q62).
- **Stat strips:** one card holding `grid gap-px bg-line`, which draws 1px dividers between `bg-surface` cells. One column on mobile, `sm:grid-cols-2`, then four columns at `lg`. On Home, the deployments chart tile is wider. The Status page uses the same tiles (A5-M4).
- **Home:** the attention table and stats span full width. Below them, Recent deployments takes about two-thirds and the Cluster and Recent activity cards take one-third (`lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]`).
- **Key and value summaries:** `grid sm:grid-cols-3` with full-width items where needed, such as the image on deployment detail (A5-M2).
- **Tiles:** project Overview service tiles use `sm:grid-cols-2 lg:grid-cols-3`, with dividers instead of gaps.

Always add `min-w-0` to grid and flex children that contain truncating text.

## Form widths

Pages are full width, so constrain the **control** (A4-Q37, A5 "Field widths" kept):

| Control | Max width |
| --- | --- |
| Single-value text field on settings pages (name, email, password, slug) | `max-w-xl` (about 560px) |
| URL, token, and textarea fields on settings pages | `max-w-[720px]` |
| Numeric fields (replicas, CPU, memory, port) | Fill their grid column (A3-C19), with the unit as a suffix inside the field |
| Search in a filter bar | `flex-1`, minimum 240px (`SearchInput`) |
| Filter selects | Size to content, or a fixed `w-[150px]` to `w-[160px]` in toolbars |
| Fields in dialogs | Full width of the dialog body |

Tables, dashboards, and lists always use the full content width.

## Scrolling

**Scroll the overflowing thing, not the page** (AGENTS.md, A1 P0-04).

- **Tables:** `Table` wraps itself in `overflow-x-auto` with `.scroll-horizontal` edge shadows. Only when it actually overflows does it become a focusable, labelled `region` (A5-H7). Don't set a global minimum width. Opt in with `<Table minWidth="md">` (640px) for wide history tables.
- **Tabs:** page tab bars are `overflow-x-auto` with `.scroll-horizontal` shadows.
- **Dialog bodies:** `DialogBody` caps at `max-h-[62vh]`, scrolls with `overscroll-contain`, and shows `.scroll-vertical` top and bottom shadows (A5-M12).
- **Logs:** the log viewer fills the viewport height with a sticky toolbar (A5-M18).
- **Bounded lists**, such as the grant-access results: set a max height with a fade at the scroll edge.
- Use `.scroll-thin` for thin, token-colored scrollbars. When the scroll area sits on a card, set `[--scroll-surface:var(--surface)]` so the edge shadows blend into the card instead of the canvas.

Narrow-screen check: no page-level horizontal scroll. One known exception is listed in [known issues](../records/known-issues.md).

## Content alignment

- Page headers: title block on the left (`max-w-2xl`), actions on the right, aligned to the **top** of the title (A3 B40).
- Card headers: title and hint on the left, actions on the right. They stack below `sm`.
- Numeric and time columns are right-aligned. Text columns are left-aligned.
- Row actions sit at the end of the row: `⋯` immediately before the chevron (A4-Q57).
