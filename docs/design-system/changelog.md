# Design system changelog

Changes to Bower's tokens, primitives, shared components, lint rules, and documented patterns, newest first. Entries are dated, and they name the commit and the audit that motivated them, where known. Feature work that doesn't change the system isn't listed.

**How to add an entry:** add a line under **Unreleased** in the same change that modifies tokens, primitives, shared components, lint rules, or a documented rule. Group it under *Added*, *Changed*, *Fixed*, *Removed*, or *Docs*. When a batch of work lands, replace "Unreleased" with the date and, if it came from one, the audit.

## Unreleased

**Added**
- `NotificationsMenu` (`src/components/notifications-menu.tsx`): a header bell listing deployment outcomes, with an unread count. Documented in [Navigation](components/navigation.md#notifications-menu) and [Status and feedback](components/status-and-feedback.md#notifications-menu-vs-toasts-and-banners). UI capture covers unread, open, read, empty, refresh-error, narrow, and dark states.

## 2026-10-04: Design system guide

**Docs**
- Added this guide in `docs/design-system/`: principles, foundations (color, theming, typography, spacing and layout, shape and elevation, motion, iconography and brand, accessibility), component references, patterns, workflow, the changelog, and a separate `records/` section (decision log, six audit records, prototype reference, known issues).
- Moved `docs/ui-audit.md` to `workflow/visual-verification.md`, and updated `scripts/ui-capture/reporter.test.mjs` to the new path.
- Merged `docs/ui-audit-remediation.md` into [records/audits/audit-01.md](records/audits/audit-01.md) and `docs/ui-fix-checklist.md` into [records/audits/audit-03.md](records/audits/audit-03.md), then deleted both.
- Pointed `AGENTS.md` and `README.md` at the guide.
- Recorded the measured dark-theme contrast failures and other drift in [known issues](records/known-issues.md).

## 2026-10-03: Audit 6 (deferred items), commit `52d7c55`

**Added**
- `SubNav` (`ui/sub-nav.tsx`): one secondary-navigation component for Settings and the Project Settings anchors, using the sidebar's active style (A5-M10).
- `PanelFooter`: "Showing *n* of *m*" plus a specific "View all … →" link, rendered only when rows are cut off (A5-V1).
- The `text-tile` type step (14px) for tile and list item titles (A5-L1).
- `.scroll-vertical` edge shadows, used by `DialogBody` (A5-M12).
- Audit actor types (user, system, API key, webhook) with matching icons on Home and the Audit log (A5-M7).

**Changed**
- `SelectContent` is at least the trigger's width and at most `max-w-xs`, and its items truncate (A5-M17).
- Dialogs are pinned near the top so they grow downward (A5-M12).
- The Status page summary reuses Home's stat tiles (A5-M4).

## 2026-10-03: Page-shaped skeletons, commit `f546626`

**Changed**
- `Skeleton` announces "Loading…" (`role="status"`). Added route-specific skeletons in `page-skeletons.tsx`, and explicit Suspense boundaries for runtime headers.

## 2026-10-03: Audit 5, commit `2c0185c`

**Added**
- Lint: `bower/named-type-scale` also rejects color utilities whose token isn't declared in `@theme` (A5-C2).
- `@import "tw-animate-css"`, so overlay enter and exit classes work (A5-L8).
- The `--color-link` token (`brand-700`).

**Changed**
- `Button`: the disabled fill and border apply to solid variants only. Ghost and link get muted text with no box (A5-H1).
- Ghost and icon-button hover moved to `bg-ink/5` (A5-L11).
- `Chip`: `tracking-normal`, so chips beside an H1 don't merge their letters (A5-H4).
- `Table`: the scroll wrapper becomes a focusable, labelled region only when it overflows (A5-H7).
- `SearchInput`: tokenised clear button, and the native search cancel button is hidden globally (A5-M16).
- `PageHeading` gained a `status` slot outside the heading element (A5-H4).

## 2026-10-03: Audit 4, commit `26fb95f`

**Changed**
- Field focus uses a `brand-500` border (with the 3px `brand-100` halo). The lint rule was updated to the new recipe (A4-Q17).
- Disabled buttons became neutral (sunken fill, `line` border, muted text) instead of using opacity (A4-Q18).
- Status labels: `pending`, `starting`, and `placed` show their own words. Added `drained` (neutral). Allocations that exited read "Failing" (A4-Q09, Q11).
- `UnsavedChangesBar` accepts a summary and counts staged variable edits (A4-Q36).
- Field validation is inline, replacing the hint (A4-Q60).

## 2026-10-03: Audit 3 (fix list B01–B73), commit `460ef29`

**Added**
- `src/lib/status.ts`: the single status table (label, tone, in-progress) (A3 B12).
- The `--text-code` token (12.5px). `.font-mono` forces it everywhere (A3-T11).
- `.overline`: the one section-label style (A3-T07).
- `#main-content[data-unsaved]` bottom padding for the floating save bar (A3 B07).
- `AlertDialogHeader` close button (A3-C12).

**Changed**
- Radius scale set to 4 / 6 / 8 / 12 (`sm`/`md`/`lg`/`xl`). Checkboxes are `rounded-sm` (A3-T01, B08, B09).
- Form controls use `border-line-strong` and the 3px focus halo (A3-T02, T03).
- Invalid fields keep danger styling while focused (A3 B11).
- `Card` is border-only. Shadows are reserved for overlays (A3-T08, B28).
- Avatar fallback became a neutral tile with a strong border (A3-T18).
- `UnsavedChangesBar` is portalled and centered on the content column (A3 B07).

## 2026-10-02: Audit 2, commit `a89b993`

**Added**
- Lint: `bower/no-low-contrast-focus` (2px `brand-500` rings) and `bower/no-faint-text` (A2-H1, A2-M18).
- `RowActions` (A2-H5), `SearchInput` (A2-L4), `UnsavedChangesBar` (A2-H6).
- `CardHeader` `title`, `hint`, `action`, and `as` API. `Panel` and `PanelHeader` became aliases of `Card` and `CardHeader` (A2-L4).
- `Label optional` (A2-M16).

**Changed**
- `ink-faint` restricted to non-text use (A2-A4).

## 2026-10-02: Audit 1 and portal review, commit `eff167a`

**Added**
- The `ok-50`, `ok-200`, and `ok-500` success family. Success is no longer brand teal (A1 P1-02).
- `src/lib/tone.ts`: one `Tone` type for chips, notices, toasts, and banners (A1 P1-03).
- The named type scale in `@theme` (`text-xs` … `text-2xl`), and the lint rule `bower/named-type-scale` with auto-fix (A1 P1-05).
- `brand-950` for the auth background (A1 P3-05). The `.text-link` style (A1 P3-02).
- `Dialog` `size` (sm, md, lg), first-field autofocus, and a focus-visible-only close ring (A1 P0-07, P2-21).
- `destructive` button variant (A1 P1-14). `Button loading` (A1 P2-16).

**Removed**
- Generic token aliases (`background`, `foreground`, `primary`, `muted`, `accent`, `border`, `input`, `success`, …) (A1 P1-01).

**Changed**
- Button icons are always 16px (14px in `sm`), regardless of Lucide class names (A1 P0-01).
- Primary hover uses `brand-600` and `brand-700` instead of a brightness filter (A1 P3-03). The dialog backdrop is `bg-ink/25` (A1 P3-04).
- Segmented option controls were replaced with selects (portal review).

## 2026-10-01: Consistency and accessibility pass, commit `6c341b4`

**Changed**
- `ink-muted` darkened to 40% lightness for AA text contrast. Dark-mode brand and danger values adjusted.
- Added `.scroll-horizontal` edge shadows for scrolling tables and tabs.

## 2026-09-18: Centralized feedback, commit `c3d1432`

**Added**
- `FeedbackProvider`, `useFeedback` toasts, `InlineNotice`, and `PageBanner` in `ui/feedback.tsx`, replacing the separate toast and toaster components.
