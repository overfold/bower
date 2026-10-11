# Design system changelog

Changes to Bower's tokens, primitives, shared components, lint rules, and documented patterns, newest first. Entries are dated, and they name the commit and the audit that motivated them, where known. Feature work that doesn't change the system isn't listed.

**How to add an entry:** add a line under **Unreleased** in the same change that modifies tokens, primitives, shared components, lint rules, or a documented rule. Group it under *Added*, *Changed*, *Fixed*, *Removed*, or *Docs*. When a batch of work lands, replace "Unreleased" with the date and, if it came from one, the audit.

## Unreleased

The entries with review IDs below record approved design contracts from **Audit review (Oct 2026)** (`bower-ui-audit-desktop-10`). Implementation and capture verification are handled separately; these entries do not assert that either has completed.

**Added**
- Required card-description rule: every CardHeader/PanelHeader gets a sentence in text-xs ink-muted, including count-titled single-card tabs; repeating subtitles and page descriptions stay (R1; M5/K3/C13 rejected).
- Shared dirty-field state for Input, Textarea, and Select: warn-500 border plus warn-50/warn-200 halo, with invalid > focus > dirty precedence (S2).
- Service Configuration's primary Save and deploy… flow: save first, then existing deploy review; Save changes is secondary only here (F1).
- Shared toneDotClasses and Tone vocabulary for status dots and Timeline, without warning aliases (M1).
- Above limit danger chip in chart readout/summary when the range exceeds its limit, synchronized with the accessible summary (C11).
- `TimeSeriesChart` `markers` (`{ t, label, tone? }`): thin tone-colored vertical lines (`toneStrokeClasses` in `src/lib/tone.ts`) for moments such as deploys. The readout names the markers in the active bucket, the summary and a key count them, and they take no focus. `MetricsHistoryCharts` is the one range/refresh component behind the service and allocation usage history, marking deploys with labels and tones from the shared deployment status vocabulary.
- `ServiceFailureNotice`, `RestartCountdown`, `UrlTabs`, and shared `ConfigDiffPreview`: body failure explanation, restart countdown, deep-linkable tabs, and bordered Field / Before / After table with masked env values, readable per-row Reveal, write-only locks, and Not set missing values (L1/L3/T9/M3). The underline tab classes live on the primitive, and an alert dialog with a `DialogBody` drops its gap.
- `Time` live readings clamp slight future sample skew to just now; genuine future/countdown contexts remain countdowns (T2/C9). `DeploymentPoller` refreshes visible health pages, pausing for dialogs and unsaved changes.
- `toneIconClasses` in `src/lib/tone.ts`: icon-only tone colors for notices on a neutral surface.
- `PageBanner` `action` slot, matching `InlineNotice` (A2-H9).
- Toast enter and exit motion: fade and a 6px rise in, fade out, removal after the exit, none under reduced motion.
- UI contracts for toast timing, live regions, tones, banner dismissal, banner actions, and dismiss labels.
- `NotificationsMenu` (`src/components/notifications-menu.tsx`): a header bell listing deployment outcomes, with an unread count. Documented in [Navigation](components/navigation.md#notifications-menu) and [Status and feedback](components/status-and-feedback.md#notifications-menu-vs-toasts-and-banners). UI capture covers unread, open, read, empty, refresh-error, narrow, and dark states.

**Changed**
- Chip owns a leading currentColor dot in every tone; callers no longer supply duplicate dots (R2/C1).
- Card titles use text-tile (14px) semibold, resolving the open size decision (R3/A2).
- Mono disables ligatures and liga/calt across font-mono, code, kbd, pre, samp and Mono (R4/A1).
- Class merging recognizes Bower's named type sizes, so `text-tile`, `text-code`, `text-md`, and `text-2xs` are retained alongside text colors (R3).
- Image cells use mono tag above text-xs muted mono repository everywhere; changed tags show from → to even in compact deployment presets and Summary (R6/C5; supersedes A4-Q05/A5-M8).
- Services and Needs attention put the name/What first, then Status (R5/C4).
- Failure explanation is one body notice with cause title, failure/restart/ready secondary line and actions; allocation notices share the anatomy, service chips are plain (L1/L3). Capacity notices explain the request and offer Edit resources / View cluster status, disabling ineffective Restart (T6).
- Allocation actions use Cancel / Cancel placement? for pending, hide Stop for failed, retain Stop for running/placed/starting and disabled behavior for stopping/stopped/lost (T5). Terminal is disabled outside running with a server guard (T4).
- Usage history and Current allocations are cards with descriptions; the range selector is in Usage history's header on service/allocation pages (L5/C14). Allocation Details puts identity first, then tiles, then history (L4).
- Project Service health is a compact clickable table, not a tile grid (L6).
- Preview counts occur only in truncated footers, not header hints; count titles in single-card tabs stay and gain descriptions (L10/R1/C13).
- Object date columns name the field: Created, Granted, or Rotated; event lists retain Time and Needs attention Since (C6/G2).
- Chart limits and legend swatches are always neutral dashed ink-muted (C11); chart readouts show local time with UTC tooltip and deployment-result marker labels (T7/T8).
- Danger zones share red title, description, left text/right danger action, wrapping on narrow screens (C21). Cards use large EmptyState, including Variables and node allocations (C22); log no-match is sans with Clear search/refocus (C23).
- InlineNotice defaults to neutral; Rolled back is warn (M2/G1). Shared tone names have no info or warning aliases (M1).
- Configuration change tables use Field / Before / After and Not set everywhere (M3). All environment values start masked with per-row Reveal where readable; write-only values stay locked, non-variable fields plain (T9; supersedes plain env values).
- Restart now names an already-scheduled restart, Restart names the header action (C20f). Domain actions use Add domain, deploy confirmations name the service, member roles use Save changes (C20b/d/e).
- Navigation keeps Projects active while the current recent-project link is bold ink and aria-current=page (N2); Settings groups are Personal / Organization / Instance (N3), with Settings › Instance › Organizations and no org crumb (N1).
- Notification items are focusable hovered links to the service or deployment, without a View all deployments footer (N5); refresh errors offer Try again (S6).
- Activity key lines share mono key, spaced middle dot, sans muted time (C10); counts use shared pluralization (C24).
- Pending allocations show reason text and muted Trellis messages, duration-only Waiting, a counted description sentence, and a reason strip only for 2+ distinct reasons (L8; broader C2 undecided).
- Projects search uses the shared SearchInput in the header, named Search, above 8 projects only (C15); form examples move to hints, searches retain Search, and Invite people teams use chip multi-select (C16/C17).
- Register password hint says Use at least 8 characters., linked to its field; theme select uses the standard settings width (C18/C19).
- Webhooks gain an optional name and Name-first list while URL/token remain one-time (F3); Bind secret hides Source, while New variable retains it (F4).
- Planning events read Planned the deployment with technical details disclosed (K1); secrets empty copy points to binding from Variables (K5); connection detail includes the version only when available (K7).
- Usage tiles emphasize value with a smaller muted limit (A4); Home deployment/allocation subtitles remain readable and wrap rather than truncate (L7).
- Rolled back is `warn` (an automatic rollback is a failed rollout) and notifies everyone with project access; failing services notify once per incident. Allocation status reads Failed and Lost, with Failing reserved for services.
- Needs attention is one row per service: one cause, a "Since" time, and one action.
- Toasts use a neutral surface with the tone on the icon only, `rounded-lg`, `py-2.5 pl-3 pr-2`, and fit-content width up to 22rem. `InlineNotice` keeps its tinted style.
- `danger` toasts stay until dismissed. Other toasts pause their 5s timer while the stack is hovered or focused, then resume with the remaining time.
- The toast stack is a "Status messages" region with sibling polite and assertive live regions. Toasts no longer carry `role="alert"` or `role="status"`.
- `PageBanner` is not dismissible by default. `dismissible` requires an explicit `id`, there is no title fallback, and a dismissed banner no longer flashes on load. The Trellis-unavailable banner can't be dismissed, and its actions moved to the `action` slot. Supersedes A1 P2-24 for condition banners.
- Toast titles no longer end with a period.

**Removed**
- info tone, color tokens/theme utilities, and lint allow-list entries; purple no longer means Rolled back (M2/G1).
- Failing-chip popover, info icon, and hover affordance (L1); redundant Home Trellis-unavailable attention row and card, retaining banner and unavailable tiles (L2).
- The `error` and `warning` tone aliases (`FeedbackTone`). Use `danger` and `warn`.

**Fixed**
- Unsaved bar reserves its height plus offset so it cannot cover fields (S1).
- Dirty fields retain invalid danger over focus and normal brand focus over dirty warn (S2).
- Relative ages under about 10s read just now, including slightly future live samples; countdowns remain explicit (T2/C9).
- CPU keeps its skeleton while waiting for the second sample; footer reads Across N tasks · Sampling until a value exists (T3).
- Tab count pills keep identical border/padding metrics across selection (S4).
- StatCell allocation meter uses brand below 85%, warn from 85%, danger from 100% (A6); Nodes tile says N nodes with healthy/draining/drained/unhealthy detail (L11).
- Project list/header health uses one live-service calculation, never deployment-history counts or a forced minimum failure (T1).
- Toast and banner dismiss buttons use token hovers (`hover:bg-sunken`, `hover:bg-ink/5`) instead of `hover:bg-black/5` (known issue).

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
