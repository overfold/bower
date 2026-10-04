# Component inventory

Check this list before building UI. If something here does the job, use it. If it almost does, extend it at the source (see [Contributing](../workflow/contributing.md)). Don't fork it into a page.

**Layers**

- `src/components/ui/`: **primitives**. Product-agnostic building blocks, mostly on Radix. They own tokens, states, focus, and accessibility.
- `src/components/`: **shared product components**. Bower-specific compositions such as status chips, deployment tables, page headings, the shell, and time.
- Route folders (`src/app/**`): page-specific components. If a second page needs one, move it up to `src/components/`.

## Primitives (`src/components/ui/`)

| Component | File | Use for | Docs |
| --- | --- | --- | --- |
| `Button`, `IconButton`, `buttonVariants` | `button.tsx` | Every clickable action. `IconButton` for labelled icon-only actions | [Buttons](buttons.md) |
| `Input`, `Textarea` | `input.tsx`, `textarea.tsx` | Text entry. `mono` for machine values | [Form controls](form-controls.md) |
| `Select` and its parts | `select.tsx` | Every set of discrete options, including filters | [Form controls](form-controls.md#select) |
| `Checkbox` | `checkbox.tsx` | Booleans in forms, multi-select lists | [Form controls](form-controls.md#checkbox-and-switch) |
| `Switch` | `switch.tsx` | Live view toggles only (Follow, Wrap) | [Form controls](form-controls.md#checkbox-and-switch) |
| `Label` | `label.tsx` | Every field label. `optional` appends "(optional)" | [Form controls](form-controls.md#label) |
| `SearchInput` | `search-input.tsx` | Search and filter fields | [Form controls](form-controls.md#searchinput) |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `card.tsx` | Every in-page container | [Cards and panels](cards-and-panels.md) |
| `Panel`, `PanelHeader`, `PanelFooter`, `SectionTitle`, `KeyValue` | `panel.tsx` | `Panel` and `PanelHeader` are aliases of `Card` and `CardHeader`. `PanelFooter` is the preview footer ("Showing 8 of 27") | [Cards and panels](cards-and-panels.md) |
| `Table` and its parts | `table.tsx` | All tabular data | [Tables](tables.md) |
| `RowActions`, `RowActionItem`, `RowActionSeparator` | `row-actions.tsx` | The `⋯` menu for rows with two or more actions | [Tables](tables.md#row-actions) |
| `Chip` | `badge.tsx` | Tone-colored labels for **state** | [Status and feedback](status-and-feedback.md#chip) |
| `InlineNotice`, `FieldError`, `PageBanner`, `FeedbackProvider`, `useFeedback` | `feedback.tsx` | Notices, field errors, page banners, toasts | [Status and feedback](status-and-feedback.md#notices-and-toasts) |
| `EmptyState` | `empty-state.tsx` | Every empty list or card, and filtered-empty states | [Content display](content-display.md#emptystate) |
| `Skeleton` | `skeleton.tsx` | Loading placeholders | [Status and feedback](status-and-feedback.md#skeleton) |
| `Dialog` and its parts | `dialog.tsx` | Forms and multi-step tasks in a modal | [Overlays](overlays.md#dialog) |
| `AlertDialog` and its parts | `alert-dialog.tsx` | Confirmations | [Overlays](overlays.md#alertdialog) |
| `DropdownMenu` and its parts | `dropdown-menu.tsx` | Menus (row actions, profile, org picker) | [Overlays](overlays.md#dropdownmenu) |
| `Popover` | `popover.tsx` | Rich, interactive explanations (failing-service cause) | [Overlays](overlays.md#popover) |
| `Tooltip` | `tooltip.tsx` | Short, non-essential explanations | [Overlays](overlays.md#tooltip) |
| `Tabs` (segmented) | `tabs.tsx` | **In-card** view switches only. Page tabs use the underline tab bar | [Navigation](navigation.md#segmented-tabs) |
| `SubNav` | `sub-nav.tsx` | Vertical secondary navigation (Settings, Project Settings) | [Navigation](navigation.md#subnav) |
| `UnsavedChangesBar` | `unsaved-changes-bar.tsx` | Draft forms with Save and Discard | [Forms and saving](../patterns/forms-and-saving.md#the-unsaved-changes-bar) |
| `Avatar` and its parts | `avatar.tsx` | People | [Content display](content-display.md#avatar) |
| `Collapsible` | `collapsible.tsx` | Disclosure sections (with a rotating chevron button) | [Content display](content-display.md#disclosure) |
| `Separator`, `ScrollArea`, `ScrollBar` | `separator.tsx`, `scroll-area.tsx` | Dividers. Custom scroll containers | — |

## Shared product components (`src/components/`)

| Component | File | Use for | Docs |
| --- | --- | --- | --- |
| `PageHeading`, `MetaItem` | `page-heading.tsx` | Every page and section heading with a status slot, meta row, and actions | [Content display](content-display.md#pageheading) |
| `StatusDot`, `DeploymentStatus`, `AllocationStatus`, `allocationStatus`, `Dot`, `Mono`, `Meter` | `status.tsx` | All status chips, monospace values, usage meters | [Status and feedback](status-and-feedback.md) |
| `Time` | `time.tsx` | **Every** timestamp | [Content display](content-display.md#time) |
| `ResourceId`, `resourceLabel` | `resource-id.tsx` | IDs and names of nodes, allocations, and opaque resources | [Content display](content-display.md#resourceid) |
| `NodeLink` | `node-link.tsx` | Links to a node page | — |
| `Timeline` | `timeline.tsx` | Lifecycle and deployment event history | [Status and feedback](status-and-feedback.md#timeline) |
| `DeploymentsTable` | `deployments-table.tsx` | **Every** deployment list (6 presets) | [Tables](tables.md#deploymentstable) |
| `ClickableTableRow` | `clickable-table-row.tsx` | Rows that navigate | [Tables](tables.md#clickable-rows) |
| `NeedsAttention` | `needs-attention.tsx` | The attention table on Home and the project Overview | [Status and health](../patterns/status-and-health.md#needs-attention) |
| `DashboardStatsBar`, `StatCell` | `dashboard-stats-bar.tsx` | Stat tile strips (Home, Status) | [Cards and panels](cards-and-panels.md#stat-tiles) |
| `LastDeployFailed` | `last-deploy-failed.tsx` | Warning marker beside a live status when the newest deploy failed | [Status and health](../patterns/status-and-health.md#live-versus-history) |
| `OneTimeSecret` | `one-time-secret.tsx` | Showing a credential once (API key, webhook, invitation) | [Secrets](../patterns/secrets-and-credentials.md) |
| `KeyValueEditor`, `parseEnvText` | `key-value-editor.tsx` | Editing key and value rows, "Paste .env" | [Content display](content-display.md#variables) |
| `VariablesSection` | `variables-section.tsx` | The variables matrix (project) and the service variables table | [Content display](content-display.md#variables) |
| `ExecDialog` | `exec-dialog.tsx` | Allocation terminal | [Overlays](overlays.md#terminal) |
| `CommandPalette` | `command-palette.tsx` | ⌘K navigation and actions | [Overlays](overlays.md#command-palette) |
| `Sidebar`, `SidebarContent`, `MobileDrawer` | `sidebar.tsx`, `mobile-drawer.tsx` | App navigation | [Navigation](navigation.md#sidebar) |
| `HeaderBar`, `OrgTeamPicker` | `header-bar.tsx`, `org-team-picker.tsx` | Top bar, breadcrumbs, organization switcher | [Navigation](navigation.md#header-bar-and-breadcrumbs) |
| `ProjectTabs` | `project-tabs.tsx` | Project page tabs (underline). The service tabs follow the same pattern | [Navigation](navigation.md#page-tabs) |
| `SettingsAnchorNav` | `settings-anchor-nav.tsx` | Sticky in-page section navigation | [Navigation](navigation.md#subnav) |
| `PageTransition` | `page-transition.tsx` | Route content fade | [Motion](../foundations/motion.md) |
| `HeadingSkeleton`, `TableSkeleton`, `FormSkeleton`, … | `page-skeletons.tsx` | `loading.tsx` route skeletons | [Empty, loading, and error states](../patterns/empty-loading-and-error-states.md#loading) |
| `TrellisReadErrorProvider`, `TrellisReadError` | `trellis-read-error.tsx` | Showing that cluster data couldn't be read | [Empty, loading, and error states](../patterns/empty-loading-and-error-states.md#unavailable-data) |
| `AuthLayout`, `GrowingTrellis` | `auth-layout.tsx`, `growing-trellis.tsx` | Sign-in, registration, and invitation pages | [Auth and public pages](../patterns/auth-and-public-pages.md) |
| `LogoMark`, `Wordmark`, `Brand` | `brand.tsx` | Brand mark | [Iconography and brand](../foundations/iconography-and-brand.md#brand) |
| `CreateProjectDialog`, `CreateServiceDialog`, `InviteTokensSection`, settings forms | various | Feature compositions. Treat them as **reference implementations** of the patterns | — |

## Helpers that are part of the design system

| Helper | File | Owns |
| --- | --- | --- |
| `cn()` | `src/lib/utils.ts` | Merging conditional classes (`clsx` + `tailwind-merge`). Always use it for `className` composition |
| `statuses`, `statusDefinition`, `statusLabel` | `src/lib/status.ts` | Status label, tone, and in-progress flag |
| `Tone`, `toneClasses` | `src/lib/tone.ts` | Tone names and their classes |
| `label()` and label maps | `src/lib/labels.ts` | Display copy for enums (roles, TLS, protection, strategies, triggers, providers), audit sentences, audit actors |
| `format*` | `src/lib/format.ts` | Time, CPU, memory, ratios, percentages, image tags, durations |
| `deriveBreadcrumbs` | `src/lib/breadcrumbs.ts` | Breadcrumb labels and links |
| `needs-attention`, `service-health`, `deployment-detail-state`, `service-releases` | `src/lib/` | The rules behind what shows as attention, health, and rollback targets |

## Adding a component

1. Search this inventory and `src/components/`. Most needs are a composition of existing pieces.
2. Decide the layer: primitive (`ui/`) or product component.
3. Build it from tokens and existing primitives. Expose variants by **name** (`variant`, `size`, `tone`, `preset`), not by accepting arbitrary classes for core styling.
4. Add a contract test in `src/lib/ui-contracts.test.ts` for anything other pages depend on, such as column sets, labels, or state classes.
5. Add it to this inventory and to the relevant component page. Note it in the [changelog](../changelog.md).
