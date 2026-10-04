# Bower design system

This guide describes how Bower looks, reads, and behaves, and how to change it safely. It is written for anyone editing the UI, people and coding agents alike. It describes the interface **as it is built today**, and the rules that keep new work consistent with it.

Bower is a deployment dashboard for Trellis. Its users are technical application developers and platform engineers who need to see what is running, notice what is broken, and act on it without guessing. The design system serves that job. It is calm and dense, color carries meaning, and the vocabulary stays the same everywhere.

## Where the truth lives

When sources disagree, use the first one in this list:

1. **Code.** `src/app/globals.css` (tokens), `src/components/ui/` (primitives), the shared product components in `src/components/`, `src/lib/status.ts`, `src/lib/tone.ts`, `src/lib/labels.ts`, `src/lib/format.ts`, the lint rules in `eslint.config.mjs`, and the contracts in `src/lib/ui-contracts.test.ts`.
2. **This guide**, everything outside [`records/`](records/README.md).
3. **The [decision log](records/decision-log.md)**, the consolidated list of design decisions currently in force.
4. **The [audit records](records/README.md#audits)**: raw findings and answers, oldest to newest. A later audit overrides an earlier one.
5. **The original design prototype** (Magic Patterns, 2026), which is reference only. It is summarized in [records/prototype-reference.md](records/prototype-reference.md). Never copy its layouts, features, or information architecture.

If you find the guide and the code disagree, decide which one is wrong. Fix the code, or update the guide in the same change. Note it in the [changelog](changelog.md) either way. Known gaps are tracked in [records/known-issues.md](records/known-issues.md).

## Contents

### Start here

- [Principles](principles.md): the ideas behind every rule, and how to break a tie between them.
- [Quick rules](#quick-rules): the fifteen rules that catch most mistakes.
- [Contributing to the design system](workflow/contributing.md): how to make a UI change, and the review checklist.

### Foundations

| Page | Covers |
| --- | --- |
| [Color](foundations/color.md) | Semantic tokens, light and dark values, contrast, tones, overlays |
| [Theming](foundations/theming.md) | System, Light, and Dark modes, `light-dark()`, `data-theme`, adding tokens |
| [Typography](foundations/typography.md) | Fonts, named type scale, heading hierarchy, monospace rule, overline, numerals |
| [Spacing and layout](foundations/spacing-and-layout.md) | App shell, content width, page rhythm, grids, form widths, breakpoints, scrolling |
| [Shape and elevation](foundations/shape-and-elevation.md) | Radius scale, borders, shadows, stacking order |
| [Motion](foundations/motion.md) | Easing, durations, enter and exit animations, reduced motion |
| [Iconography and brand](foundations/iconography-and-brand.md) | Lucide icons, sizes, meanings, logo and wordmark, auth background |
| [Accessibility](foundations/accessibility.md) | Focus, contrast, keyboard, labels, live regions, non-color cues |

### Components

| Page | Covers |
| --- | --- |
| [Component inventory](components/README.md) | Every shared component, where it lives, and when to use it |
| [Buttons](components/buttons.md) | `Button`, `IconButton`, variants, sizes, loading, disabled |
| [Form controls](components/form-controls.md) | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `SearchInput`, `FieldError` |
| [Cards and panels](components/cards-and-panels.md) | `Card`, `CardHeader`, `PanelFooter`, `KeyValue`, stat tiles |
| [Tables](components/tables.md) | `Table`, `ClickableTableRow`, `DeploymentsTable`, `RowActions` |
| [Status and feedback](components/status-and-feedback.md) | `Chip`, `StatusDot`, `DeploymentStatus`, `Meter`, `Timeline`, `InlineNotice`, toasts, `PageBanner`, `Skeleton` |
| [Overlays](components/overlays.md) | `Dialog`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, command palette, terminal |
| [Navigation](components/navigation.md) | Sidebar, header bar, breadcrumbs, organization picker, page tabs, `Tabs`, `SubNav` |
| [Content display](components/content-display.md) | `PageHeading`, `MetaItem`, `Time`, `ResourceId`, `Mono`, `EmptyState`, `Avatar`, `OneTimeSecret`, variables |

### Patterns and rules

| Page | Covers |
| --- | --- |
| [Page structure](patterns/page-structure.md) | Page anatomy, entity headers, tabs and section headings, descriptions, shells |
| [Information architecture](patterns/information-architecture.md) | Sidebar groups, breadcrumbs, project and service tabs, settings, command palette |
| [Status and health](patterns/status-and-health.md) | Status vocabulary per object, tones, live versus history, Needs attention |
| [Actions and hierarchy](patterns/actions-and-hierarchy.md) | Primary actions, verbs, header actions, row actions, disabled actions |
| [Forms and saving](patterns/forms-and-saving.md) | Field anatomy, validation, save models, the unsaved-changes bar, units, widths |
| [Destructive actions](patterns/destructive-actions.md) | Delete, Remove, and Revoke, confirmations, typing to confirm, danger zones, blocked deletes |
| [Tables and lists](patterns/tables-and-lists.md) | Column rules, row navigation, filters, search, pagination, previews |
| [Empty, loading, and error states](patterns/empty-loading-and-error-states.md) | Empty states, skeletons, pending buttons, errors, not-found, unavailable data |
| [Data formatting](patterns/data-formatting.md) | Time, units, ratios, images, IDs, masking |
| [Content and copy](patterns/content-and-copy.md) | Voice, capitalization, terminology, labels, plurals, people, audit sentences |
| [Secrets and credentials](patterns/secrets-and-credentials.md) | One-time secrets, masked values, write-only values, bindings |
| [Deployments and recovery](patterns/deployments-and-recovery.md) | Deploy review, rollback, failed deployments, failing services, restart |
| [Auth and public pages](patterns/auth-and-public-pages.md) | Sign-in, registration, invitations, protected-route pages, not-found |

### Workflow

- [Contributing](workflow/contributing.md): changing shared behavior at its source, lint rules, contracts, and the review checklist.
- [Visual verification](workflow/visual-verification.md): the UI capture workflow (screenshots of every route and flow against a fake cluster).

### History and records

- [Changelog](changelog.md): what changed in the design system, and when.
- [Records](records/README.md): audits, findings, decisions, the prototype comparison, and known issues. These are kept separate from the guide. They explain **why** things are the way they are. They are not instructions.

## Quick rules

1. **Use the tokens.** Colors come from `@theme` in `globals.css` (`canvas`, `surface`, `sunken`, `line`, `ink-*`, `brand-*`, `ok-*`, `warn-*`, `danger-*`, `info-*`). Never use the default Tailwind palette, hex values, or arbitrary colors. Lint rejects unknown color utilities.
2. **Use the named type scale** (`text-2xs` through `text-2xl`, plus `text-code` and `text-tile`). Never write `text-[13px]`. Lint auto-fixes it.
3. **`ink-faint` is never text.** Use it only for decorative icons, dots, and chevrons. Body text is `ink`, `ink-soft`, or `ink-muted`.
4. **Green means healthy or succeeded. Teal means brand, selection, and links.** Purple (`info`) means "Rolled back" only. Amber (`warn`) means "needs attention". Work in progress is neutral with a spinner.
5. **Status labels and tones come from `src/lib/status.ts`.** Render them with `StatusDot`, `DeploymentStatus`, or `AllocationStatus`. Never write a page-local status map.
6. **Chips are for state that changes.** Static attributes (roles, environment, TLS, team names, counts) are plain text.
7. **Use mono for values people copy**, such as images, hostnames, IDs, environment keys, paths, ports, and versions. Titles stay sans, even when they are identifiers.
8. **Cards have a border and no shadow.** Shadows belong to overlays: menus, dialogs, toasts, and the unsaved-changes bar.
9. **Each card has at most one primary button.** Final destructive confirmations use `destructive` (solid red). The button that opens them uses `danger` (outlined red).
10. **Delete destroys, Remove detaches, Revoke ends a credential or grant.** Create new things with "New X" and "Create X". Relate existing things with "Add" or "Attach".
11. **Validate on submit, inline.** Keep submit buttons enabled, show the message under the field in `danger-500`, and focus the first invalid field. Use a banner only for errors that don't belong to a field.
12. **Draft forms save through `UnsavedChangesBar`.** Single actions such as "Update password" keep their own button.
13. **Whole rows are clickable** when they open something. They show a hover background and a trailing chevron, and the primary name is a real link.
14. **Times are relative in lists and absolute on detail pages.** Both use `<Time>`, which shows local time with UTC in the tooltip.
15. **Keep keyboard focus visible.** Buttons and links use a 2px `brand-500` ring with a 2px offset. Fields use a `brand-500` border with a 3px `brand-100` halo. Don't remove either.
