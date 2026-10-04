# Empty, loading, and error states

Every data surface has four states: **loading, empty, error, and populated**. Design all four.

## Empty states

Use `EmptyState` (icon, title, body, action) everywhere, at the same large size, including inside cards (A2-D9, A3-C09).

| Kind | Title | Body | Action |
| --- | --- | --- | --- |
| **First use** (nothing exists yet) | What is missing: "No routes yet" | What it is for, in one sentence | The create action, as primary: "+ New route" |
| **Filtered-empty** | "No deployments match these filters" | "Try a different search or reset all filters." | **"Clear filters"** (primary) (A3-C10) |
| **Search with no results** (palette) | — | "No results for "…"" | None (A3-N20) |
| **Not possible yet** | What is missing | Why, and what unlocks it | The action, disabled with a reason, or a link to the prerequisite |
| **Nothing to report** (Needs attention) | — | — | Hide the section entirely (A2-B8) |
| **Empty section on an operational page** (no pending allocations) | One slim line: "No pending allocations" | — | — (A3-L14) |

Rules:
- Give a next step whenever the user can act (A2-M7).
- When a list is empty, hide "View all" and pagination.
- **Empty project:** one setup checklist card (Create a service → Deploy it → Add a route). Later steps are disabled with the reason ("Available after you create a service.") (A3-L09).
- Use the object's icon in the tile (`Folder` for projects, `Rocket` for deployments, `Globe` for routes).
- A project with no services reads "No services", with zero counts and "Never" for last deploy (A4-Q69).

## Loading

| Situation | Treatment |
| --- | --- |
| Route navigation | `loading.tsx` with a **skeleton that matches the page's shape**, built from `page-skeletons.tsx` (`TablePageSkeleton`, `FormSkeleton`, `SettingsSkeleton`, `NodeSkeleton`, …) (A1 P2-16, A2-H3) |
| Entity tabs (project, service) | The header and tabs stay rendered in the layout, and only the tab content shows a skeleton. Never blank the header (A2-H3) |
| Slow parts of a page (live health, runtime headers) | An explicit `Suspense` boundary with a local skeleton (`ServiceHeaderSkeleton`) |
| A stat or metric value not yet known | A `Skeleton` bar in place of the value, never "Sampling…" or a dash (A3-C21). A live footer reads "Updated 5s ago" |
| Button action | `Button loading` (spinner, disabled, `aria-busy`). No page spinner |
| Deployment in progress | A neutral chip with a spinner. `DeploymentPoller` refreshes until it finishes |

Skeletons use `Skeleton` (`bg-line`, pulse, `role="status"`), and their containers set `aria-busy="true"` with an `aria-label` ("Loading table").

## Errors

| Error | Where | Component |
| --- | --- | --- |
| Field validation | Under the field | Hint replaced by danger text (see [Forms](forms-and-saving.md#validation)) |
| Form or server error in a dialog | Top of the dialog body | `InlineNotice tone="danger"` |
| Action failure from a header or row | Bottom-right toast | `toast({ tone: 'danger', title })` (A1 P2-15) |
| A page can't load | Route error boundary (`src/app/(dashboard)/error.tsx`) | H1 "Page unavailable", a danger notice, "Try again" and a link to Home |
| Copy to clipboard fails | Inline, next to the control | "Copy failed" (`ResourceId`) or a danger toast (`OneTimeSecret`) |

Error copy says what happened and what to do next, in plain language. Don't show raw exception text unless it is the only useful information (Trellis messages, for example, are shown as the cause).

## Unavailable data

Bower depends on a live Trellis cluster. When it can't be reached:

- **Organization-wide:** `TrellisReadErrorProvider` shows a `PageBanner` (`warn` tone), "Trellis is unavailable.", with the message. **Retry connection** and **Check connection settings** (to `/settings/organization#connection`) sit in the banner's `action` slot, beside the text. The banner can't be dismissed: it shows exactly while Trellis is unreachable.
- **Per section:** `TrellisReadError title message` renders a quiet block inside the card (`role="status"` when the banner already explains it, `alert` otherwise) with **Retry**.
- **Never substitute a reassuring value.** Readiness reads "Unavailable · 2 desired". Health reads unknown. Needs attention says it couldn't check, not "All clear" (A1 P1-19, A2-M1).
- **Not configured** (no cluster connection) reads "Not configured" in muted text, with a Configure link where the user can act (A1 P2-09).

## Not found

| Scope | Page | Content |
| --- | --- | --- |
| Inside the dashboard | `src/app/(dashboard)/not-found.tsx` | `Folder` tile, title "Page not found", **the requested path in mono**, a one-line explanation, "Go to projects" (primary), and a "Search with ⌘K" hint (A1 P0-08, A2-H3) |
| Outside the dashboard (public) | `src/app/not-found.tsx` | Bower wordmark, "Page not found", explanation, "Go to Home" |
| Invalid invitation | Invitation page | The **specific reason** (expired on …, already used, revoked) and a "Sign in" button (A3 B63) |
| Unknown entity in a breadcrumb | Header | The requested slug in mono, never a prettified guess (A5-L6) |
