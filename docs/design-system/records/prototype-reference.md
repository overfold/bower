# Prototype reference

Bower's visual language started from a **Magic Patterns prototype** (a Vite + React + Tailwind 3 app, `design-system-prototype.zip`). This record captures what the prototype defined and how Bower relates to it today.

> **Scope.** The prototype is a reference for the design system only: tokens, component shapes, and motion. **Don't use it as a reference for views, information layout, navigation, or features.** Its pages show a different product structure (for example canary progress, plan diffs, and an Automation page), and Bower's [decisions](decision-log.md) override it wherever they differ. Where Bower's current values are more accessible, Bower's values win.

## Tokens

| Token | Prototype | Bower today (light) | Relationship |
| --- | --- | --- | --- |
| `canvas` | `#F2F4F4` | `#F1F3F3` | Adopted (kept, A3-T09) |
| `surface` | `#FFFFFF` | `#FFFFFF` | Adopted |
| `sunken` | `#F7F9F9` | `#F6F8F8` | Adopted |
| `line` | `#E3E7E8` | `#E3E7E8` | Adopted |
| `line-strong` | `#CFD6D8` | `#CFD6D8` | Adopted. Bower also uses it for control borders (A3-T02) |
| `ink` | `#0C1416` | `#0D1517` | Adopted |
| `ink-soft` | `#3F5155` | `#3F5155` | Adopted |
| `ink-muted` | `#75878B` (about 3.8:1) | `#5D6C6F` (5.5:1) | **Bower is darker**, for AA text contrast |
| `ink-faint` | `#9DABAE` | `#9DABAE` | Adopted, **non-text only** (A2-A4). Bower lints against text use |
| `brand-50…900` | `#EDF6F4` … `#052A26` (500 = `#0E6E62`) | `#EEF6F5` … `#052925` (500 = `#0E6C60`) | Adopted, practically identical. Bower adds `brand-950` (`#0B1915`) for the auth background and `link` = `brand-700` |
| `warn` 50/200/500 | `#FEF4E7` / `#F6D7AC` / `#B45309` | `#FEF4E7` / `#F6D7AC` / `#B35309` | Adopted |
| `danger` 50/200/500 | `#FDECEA` / `#F5C4BE` / `#B42318` | `#FDEAE8` / `#F5C3BD` / `#B42318` | Adopted. Bower adds `danger-600` for the destructive hover |
| `info` 50/200/500 | `#F1EEFC` / `#D6CCF6` / `#6941C6` | `#F1EEFC` / `#D5CBF6` / `#6A43C7` | Adopted. Bower narrows its meaning to Rolled back |
| Success | None (brand teal meant healthy) | `ok` 50/200/500 (green) | **Bower adds a separate status green** (A1 P1-02, A3-T04) |
| Dark theme | None | `light-dark()` pairs for every token | Bower only |
| Fonts | Inter, JetBrains Mono | Same, via `next/font` | Adopted |
| `text-2xs` | 11px / 16px | Same | Adopted. Bower adds a full named scale |
| Mono size | 12.5px | 12.5px (`text-code`, forced by `.font-mono`) | Adopted |
| `tracking-tightest` | −0.035em | Same | Adopted |
| Shadows `card`, `raised`, `pop` | Defined | Same values | Adopted. Bower stops using `card` on cards (A3-T08) |
| Easing `enter`, `move` | Defined | Same | Adopted |
| Radius | Tailwind defaults (`rounded-md` chips, `rounded-lg` controls, `rounded-xl` panels) | 4 / 6 / 8 / 12 named scale | Adopted as an explicit scale (A3-T01) |
| `.nums`, `.scroll-thin`, reduced-motion reset | Defined | Same, tokenized | Adopted |

## Components

| Prototype | Bower | Notes |
| --- | --- | --- |
| `Button` (primary, default, ghost, danger; sm, md, lg) | `Button` | Bower adds `destructive` and `link`, a `loading` state, a 2px `brand-500` focus ring (the prototype's `brand-300` failed contrast), neutral disabled states (the prototype used `opacity-45`), and no `shadow-card` |
| `IconButton` (label required) | `IconButton` | Same idea. Hover `bg-ink/5` (prototype `black/4`) |
| `Chip`, `Dot`, `HealthPill`, `DeployPill` | `Chip`, `Dot`, `StatusDot`, `DeploymentStatus` | The prototype mapped healthy → brand and deploying → warn with a pulse. Bower maps healthy → success, and in progress → neutral with a spinner |
| `Meter` (warn 70%, danger 85%, minimum 2% fill) | `Meter` (warn 85%, danger 100%, 0% renders empty) | Thresholds changed (A4-Q55) |
| `Mono` | `Mono` | Same |
| `Panel`, `PanelHeader` (13px title, `shadow-card`) | `Card`, `CardHeader` (aliased as `Panel`) | Bower has no shadow, adds `overflow-hidden`, and adds hint and action slots |
| `KeyValue`, `SectionTitle` | Same | Same |
| `TabBar` (route tabs, sliding underline, count pill) | `ProjectTabs`, `ServiceTabs` | Adopted. The inactive count pill is on white with a border (A4-Q23) |
| `Field` (label, then hint **above** the control, then the control) | `Label`, control, hint **below** | Bower puts hints under fields (A1 P2-11). It uses strong borders, no shadow, and a `brand-500` focus border |
| `Modal` (hand-rolled) | Radix `Dialog` / `AlertDialog` | Bower keeps Radix for focus management, and borrowed the 62vh scrolling body |
| `EmptyState` | `EmptyState` | Same structure |
| `PageHeader` | `PageHeading` | Bower adds the status slot, meta row, and heading levels |
| `Table` | `Table` | Bower adds overflow-aware focus regions and a hidden actions header |
| Sidebar with grouped navigation and an org and connection footer | Grouped sidebar | Bower adopted the grouping only. No connection footer (A3-N04) |
| `CommandPalette` | `CommandPalette` | Bower defines its own content rules (Recent, Go to, Actions) |
| Segmented controls for options | Not used | Rejected in the portal review. Bower uses selects |
| `GrowingTrellis` (auth) | `GrowingTrellis` | Kept (A3-A01), now full-page with vertical vines |

## Not adopted from the prototype

- Its page layouts, navigation, and feature set (canary progress, plan diff, automation pages, and so on).
- `focus:ring-brand-300` and `focus:border-brand-300` (they fail WCAG 1.4.11).
- `disabled:opacity-45`.
- `shadow-card` on panels, inputs, and buttons.
- Brand teal as "healthy" and amber as "deploying".
- `placeholder:text-ink-faint` (fails contrast). Bower uses `ink-muted`.
