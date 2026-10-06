# Status and feedback

Sources: `src/components/ui/badge.tsx` (`Chip`), `src/components/status.tsx`, `src/lib/status.ts`, `src/lib/tone.ts`, `src/components/timeline.tsx`, `src/components/ui/feedback.tsx`, `src/components/ui/skeleton.tsx`, `src/components/last-deploy-failed.tsx`.

For **which** status to show and **what to call it**, see [Status and health](../patterns/status-and-health.md).

## Chip

```tsx
<Chip tone="success"><Dot tone="success" />Healthy</Chip>
```

`inline-flex gap-1.5 rounded-md border px-2 py-0.5 text-2xs font-medium tracking-normal whitespace-nowrap`, plus `toneClasses[tone]`.

- Chips represent **state that changes**: health, deployment result, verification, invitation status, ingress status, "Undeployed changes", the role of an invitation.
- Static attributes are plain text: environment, TLS, protection, capabilities, team names, member roles, counts (A1 P2-20, AGENTS.md).
- Chips never wrap, and keep normal tracking even beside a tight H1 (A5-H4).
- Don't build chips from raw classes. Use `Chip` with a `tone`, or one of the status components below.

## Status components

Always render statuses through these components. They read label, tone, and progress from `src/lib/status.ts`, so the vocabulary can't drift.

| Component | Renders | Use for |
| --- | --- | --- |
| `StatusDot status` | A chip with a tone dot and the label, or a spinner when `inProgress` | Live health of services, allocations, and nodes. Generic statuses |
| `DeploymentStatus status` | A chip with the deployment vocabulary: in-progress statuses collapse to **"In progress"**, and `healthy` reads **"Succeeded"** | Deployment results everywhere |
| `AllocationStatus phase health` | `StatusDot` for `allocationStatus(phase, health)`: health while running, otherwise the phase, with failed and dead collapsing to **"Failed"** and lost staying **"Lost"** ("Failing" is a service-level word) | Allocation rows and headers (A2-B6, A4-Q9) |
| `Dot tone pulse?` | A 6px dot | Inside chips, legends, compact lists |

Unknown values fall back to `label()` (sentence-cased) with a neutral tone. If a new status appears, **add it to `statuses`**, not to the page.

Contract: `src/lib/ui-contracts.test.ts` asserts the label, tone, and spinner for the key statuses.

### Interactive status chip

When a status needs an explanation (a failing service), the chip itself is the trigger (A3-L19, A5-H6):

- Wrap the `Chip` in a `<button aria-haspopup="dialog">` with a focus ring.
- Add an `Info` icon (ⓘ) **inside** the chip, plus a hover state (`group-hover:bg-danger-200`), so it looks clickable.
- Open a `Popover`. Its title matches the chip word ("Failing"), and under it go the restart state ("Restart pending · next attempt in 30s"), the failure count, the last failure message, and the actions "Restart now" and "View logs" (A4-Q10).

Reference: `src/app/(dashboard)/projects/[slug]/services/[serviceSlug]/service-status.tsx`.

### `LastDeployFailed`

A small `TriangleAlert` icon link in `warn-500`, shown **beside** a live status chip when the service is running but its newest deployment failed. It has the tooltip "Last deploy failed · View diagnostics" and links to the deployment (A2-B2).

## Meter

```tsx
<Meter value={13} label="CPU" />
```

A `h-1.5` bar, at most 88px wide, with an always-visible `bg-line` track, then a right-aligned `.nums` percentage.

- The fill uses the `brand` tone and turns **`warn` at ≥ 85%** and **`danger` at ≥ 100%** (A4-Q55). It renders at 0% width instead of disappearing.
- It has `role="img"` and `aria-label="{label} {value}%"`.
- Label meters that sit side by side ("CPU 13%", "Memory 3%"), with values on one line (A5-M4).
- **Capacity bars** (node page) are one bar per resource: allocated in `brand-200`, used in `brand-500` drawn over it, with a legend. If usage exceeds the allocation, cap the fill and add a warn note (A4-Q54).

Contract: "meters warn at 85%, become dangerous at 100%, and render zero fill".

## Timeline

```tsx
<Timeline items={[{ id, title: 'Placed on node-eu-west-01', time: <Time value={…} />, tone: 'neutral' }]} />
```

A vertical list with connecting lines and 14px dots ringed with `surface`.

- Use it for allocation lifecycle and deployment events (A3-L26).
- Dot tones: `neutral` (ink-faint) for passed steps. `success`, `info`, `warning`, and `danger` for outcomes. **No spinners in history** (A3 B13).
- Titles use the same labels as chips, capitalized ("Pending", "Starting", "Running"). Raw event keys go in the title's tooltip (`titleTooltip`), not on the page (A4-Q46).
- Details are collapsed by default and render as key and value pairs, never raw JSON (A1 P1-13).

## Notices and toasts

Three channels, one tone system:

| Component | Placement | Use for | Dismiss |
| --- | --- | --- | --- |
| `InlineNotice tone action? icon?` | In the flow, at the top of the relevant card or dialog body | Context the user should read **here**: a failure reason at the top of a failed deployment, "You won't see this again." in a one-time secret dialog, a server error in a dialog | No |
| Toast (`useFeedback().toast({ title, description?, tone })`) | Bottom right, one right-aligned stack (at most 4) | Results of an action: "API key copied", "Couldn't restart Storefront". **Action errors in headers use toasts**, so buttons don't shift (A1 P2-15) | ✕. `danger` stays until dismissed; other tones leave after 5s |
| `PageBanner tone title action? dismissible? id?` | Full width across the top of the content | Organization- or page-wide conditions: "Trellis is unavailable." | None by default: the banner shows exactly while its condition holds. `dismissible` with an explicit `id` hides it for the session |

Rules:
- Tones: `success`, `info`, `warn`, `danger`, `neutral`, and `brand`. There are no `error` or `warning` aliases.
- Each notice has a default tone icon (`CheckCircle2`, `CircleAlert`, `TriangleAlert`, `Info`).
- A notice's action is a **button beside the text**, not a link inside the sentence (A2-H9). `InlineNotice` and `PageBanner` both take it as `action`. In a banner the action sits to the right of the text from `sm` up and wraps below it on narrow screens.
- Show a warning **once** per dialog, under the description (A5-H3).
- Toasts confirm. They don't carry information the user must act on later.
- Titles have no closing period ("Password updated", "Could not roll back"). A description that is a full sentence ends with one (see [Content and copy](../patterns/content-and-copy.md#capitalization-and-punctuation)).

### Toast anatomy

```tsx
const { toast } = useFeedback()
toast({ tone: 'success', title: 'Logs copied' })
toast({ tone: 'danger', title: 'Could not roll back', description: 'The rollback could not be started.' })
```

- **Surface:** `bg-surface border border-line text-ink rounded-lg shadow-raised`, `py-2.5 pl-3 pr-2`, `gap-2.5`, `items-start`. The tone shows on the **icon only**, through `toneIconClasses` in `src/lib/tone.ts`. `InlineNotice` and `PageBanner` keep the tinted `toneClasses`, because they sit in the flow.
- **Text:** title `text-sm font-medium leading-snug text-ink`; description `mt-0.5 text-xs text-ink-muted`.
- **Width:** `w-fit`, at most 22rem (and the full width on narrow screens), right-aligned so short confirmations stay short.
- **Dismiss:** a 14px `X` in a 20px `rounded-sm` button, `text-ink-muted`, `hover:bg-sunken hover:text-ink`, the 2px `brand-500` focus ring, and `aria-label="Dismiss: {title}"`.
- **Timing:** `danger` toasts stay until dismissed. Other tones leave after 5s. The timer pauses while the stack is hovered or contains focus, then resumes with the time that was left.
- **Live regions:** the stack is a `section` labelled "Status messages" (not "Notifications", which names the header menu) holding two sibling regions that are always mounted: `aria-live="polite"` for most tones, then `aria-live="assertive"` for `danger`. Toasts carry no `role`. Both regions render as one column, with danger toasts at the bottom.
- **Motion:** fade and a 6px rise in (200ms, `ease-enter`), fade out (150ms). Removal waits for the exit. Under reduced motion there is no movement, and a dismissed toast is removed at once.

### Page banner dismissal

A banner reports a live condition. Remembering a dismissal by title hid later recurrences of the same condition, so banners are **not dismissible by default**. Opt in with `dismissible` only for advisory banners the user may reasonably hide for the session, and pass a stable `id` (the session key is `bower.banner.{id}`). TypeScript rejects `dismissible` without an `id`. Because `sessionStorage` is client-only, a dismissible banner renders nothing on the server and during hydration, so a dismissed banner never flashes in and out on load.

Contract: `src/lib/ui-contracts.test.ts` covers toast timing (danger persists, hover and focus pause), the sibling live regions, the absence of tone aliases, banner dismissal, the banner action slot, and dismiss labels. `src/lib/trellis-boundaries.test.ts` covers the Trellis banner.

### Notifications menu vs toasts and banners

The header's [notifications menu](navigation.md#notifications-menu) holds what the user may need to act on **later**. Today that means deployment outcomes that happened while they were looking elsewhere.

| Channel | Answers | Lifetime |
| --- | --- | --- |
| Toast | "Did my click work?" | Seconds: gone after 5s, paused while hovered or focused. A `danger` toast stays until dismissed |
| `PageBanner` | "Is something wrong right now, everywhere?" | While the condition lasts. Only an advisory banner that opts in with `dismissible` and an `id` can be hidden for the session |
| Notifications menu | "What happened while I was away?" | A stored, per-user history, with unread state that survives reloads and devices |

- Don't repeat a toast in the menu, or the reverse. A deployment you start gets a toast for the request, and the menu entry for its outcome.
- Don't use the menu for conditions that are still happening (Trellis unavailable). That is a banner.
- Rows use the shared status components (`DeploymentStatus`), never their own chips.

## `FieldError`

`<FieldError>{message}</FieldError>` renders `text-xs text-danger-500` with `role="alert"`, or nothing when there is no message. Prefer the hint-replacement pattern in [Form controls](form-controls.md#field-anatomy) when the field has a hint.

## Skeleton

`<Skeleton className="h-4 w-36" />`: a `bg-line` block with `animate-pulse` (stopped under reduced motion), `role="status"`, and `sr-only` "Loading…".

Compose page skeletons from `src/components/page-skeletons.tsx` (`HeadingSkeleton`, `TableSkeleton`, `FormSkeleton`, `ServiceHeaderSkeleton`, `NodeSkeleton`, …). A skeleton should match the **shape** of the page it stands in for (A2-H3). See [Empty, loading, and error states](../patterns/empty-loading-and-error-states.md#loading).

## Spinners

`Loader2` with `animate-spin` appears in exactly two places: `Button loading` and in-progress status chips. Nowhere else.
