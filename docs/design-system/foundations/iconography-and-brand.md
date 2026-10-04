# Iconography and brand

## Icon library

Bower uses **[Lucide](https://lucide.dev)** (`lucide-react`) exclusively. Don't mix in other icon sets, emoji, or hand-drawn SVGs. The only exceptions are the brand mark and the decorative auth background.

## Sizes

| Context | Size | How |
| --- | --- | --- |
| Inside `Button` (`md`, `lg`) | 16px | Automatic: `[&_svg]:size-4`. Don't add size classes |
| Inside `Button size="sm"` | 14px | Automatic: `[&_svg]:size-3.5` |
| Inside `IconButton` | 16px | Automatic |
| Sidebar and navigation items | 16px | `h-4 w-4` |
| Inline with text (trigger column, breadcrumbs, meta items, chips) | 12–14px | `size-3` (chip spinner) or `size-3.5` |
| Empty-state tile | 16px icon in a 40px `sunken` tile | `EmptyState icon={<Folder className="h-4 w-4" />}` |
| Not-found and error tile | 20px | `size-5` |

Icons inside buttons get their spacing from the button's `gap-2`. Don't add `mr-*` or `ml-*` to icons (A1 P2-23). The sizing rule covers every Lucide icon, including ones whose class names contain `h-` (A1 P0-01, regression-tested in `src/lib/button.test.ts`).

## Color

- Icons inherit `currentColor` by default.
- Decorative icons next to text use `text-ink-faint` (allowed for non-text) or `text-ink-muted`.
- Status icons take the tone color (`text-warn-500` for the "last deploy failed" marker).
- Icons that are the only content of a control must have an accessible name: `IconButton label`, `aria-label`, or `sr-only` text. Purely decorative icons get `aria-hidden`.

## Meanings

Each icon has one meaning (A1 P2-22). Reuse these, and don't give them new meanings.

### Navigation and objects

| Icon | Means |
| --- | --- |
| `LayoutDashboard` | Home |
| `Folder` | Project (sidebar, recent projects, empty states, not-found). **The only project icon** (A3-T17) |
| `History` | Deployments (page) |
| `Server` | Status (cluster, nodes) |
| `ScrollText` | Audit log |
| `Settings` | Settings |
| `Building2` | Organization (org picker) |
| `Users`, `User` | Teams, people |
| `Globe` | Domains, routes |
| `HardDrive` | Volumes |
| `KeyRound`, `Key` | API keys, secrets |
| `Webhook` | Webhooks, webhook triggers |
| `Bell` | Notification channels |

### Actions

| Icon | Means |
| --- | --- |
| `Plus` | **Create triggers** ("New service", "Invite people", "Attach volume"). Never on dialog submit buttons (A3-C05) |
| `Rocket` | **The Deploy action only**. Never a page or nav item |
| `RotateCcw` | Roll back (also the "Rollback" trigger type) |
| `RefreshCw` | Restart, check again |
| `Trash2` | Delete or remove, as a single row action |
| `MoreHorizontal` (⋯) | Row actions menu (`RowActions`) |
| `Pencil` | Edit this row |
| `Copy` → `Check` | Copy, then a 2-second "Copied" state |
| `Eye` / `EyeOff` | Reveal or mask a value |
| `Upload` | Upload a file (secret value) |
| `Terminal` | Open a terminal |
| `Maximize2` / `Minimize2` | Full screen on or off |
| `Search` | Search fields, command palette trigger |
| `X` | Close a dialog, dismiss a toast or banner, clear search |
| `ExternalLink` | Opens an external URL (public route hostname) |
| `ChevronRight` | Row navigation (trailing chevron), breadcrumb separator |
| `ChevronDown` / `ChevronUp` | Select trigger, disclosure (rotating) |
| `ChevronsUpDown` | Org and team switcher trigger |

### Status and feedback

| Icon | Means |
| --- | --- |
| `Loader2` (spinning) | In progress right now. Pending buttons and in-progress chips |
| `CheckCircle2` | Success toast or notice |
| `CircleAlert` | Danger toast or notice |
| `TriangleAlert` | Warning toast or notice. The "Last deploy failed" marker |
| `Info` | Info toast or notice. ⓘ tooltip triggers for jargon and field explanations |
| `LockKeyhole` | Write-only value |
| `Dot` (component, not Lucide) | A 6px tone dot inside status chips |

### Audit actors and deployment triggers

| Icon | Means |
| --- | --- |
| `User` / `UserIcon` | A person. Manual trigger |
| `Bot` | System |
| `Key` | A person acting via an API key ("Alex Morgan via API key GitHub Actions") |
| `Webhook` | A webhook |
| `GitBranch` | Promotion trigger |
| `ShieldAlert` | Automatic rollback trigger |

Audit actors never use initials. The four actor types are shown with icons, the same way on Home and in the Audit log (A5-M7).

## Brand

Source: `src/components/brand.tsx`.

| Element | Notes |
| --- | --- |
| `LogoMark` | 24×24 SVG: a rounded `brand-500` tile with a white arch and a fine trellis lattice. `aria-hidden` (pair it with text) |
| `Wordmark` / `Brand` | The mark plus **lowercase "bower"** in `font-bold tracking-tightest`. Sizes: `sm` (sidebar), `default` (auth pages), `lg` |
| Favicon | `src/app/icon.svg` |
| Product name in prose | "Bower", capitalized. The wordmark alone is lowercase |
| Auth background | `GrowingTrellis` on `bg-brand-950`: vines that grow up from the bottom edge, once per visit, behind a centered white card |

Brand rules:
- The mark appears in the sidebar header (it links to Home), on sign-in, registration, and invitation pages, and as a small "Protected by Bower" footer on protected-route pages.
- Protected-route pages for **site visitors** are neutral and light, with no marketing panel or tagline (A3-A03, A5-H5).
- Brand teal is an accent, not a background. The only brand surface is the dark auth background.
- `ConstellationBg` (`src/components/constellation-bg.tsx`) is currently unused. Don't adopt it for new surfaces without a decision.
