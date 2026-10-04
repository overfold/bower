# Actions and hierarchy

## One primary per context

- **At most one `primary` button per card, dialog, or page header** (A3-C04, AGENTS.md). Make it the action most people came to take.
- If two actions seem equally primary, one of them belongs somewhere else, usually in a different card or a menu.
- The primary can change with state:

| Context | Primary |
| --- | --- |
| Service header | Deploy. Highlighted while there are undeployed changes |
| Deployment page, failed, with a good release available | Roll back to {last good} (A3-F21) |
| Deployment page, failed, no good release | None. Redeploy and Edit configuration are default buttons |
| Deployment page, the release that is running now | None. "Roll back…" is a default button (A4-Q15) |
| Deployment page, superseded | None (A5-C3) |
| Filtered-empty list | Clear filters (A3-C10) |
| Empty project | Create a service (checklist step 1) |
| Dialog | The submit action ("Create service", "Save changes") |
| Confirmation | The confirm action: `destructive` for destruction, `primary` for recovery |

## Where actions go

| Kind | Placement | Style |
| --- | --- | --- |
| Entity actions (Deploy, Restart, Roll back…, Terminal, Stop) | Page header, top right | `default`, plus at most one `primary` |
| Create and bulk actions for a list ("+ New route", "Paste .env", "Grant access") | Card header `action` slot (A3-C03) | `size="sm"`. The create trigger is primary when it is the card's main action |
| Continue to more rows ("View all deployments →") | Card footer (`PanelFooter`) (A5-V1) | Text link |
| Row actions | End of the row | One action: an icon button. Two or more: a `⋯` menu (A3-C01) |
| Recovery or next step for a problem | In the row or notice that shows the problem ("View logs", "Restart now") | `default` `sm` |
| Destructive action on an entity | Danger zone, last on the page (A4-Q26) | `danger` (outlined) |
| Rename (team) | Page header (A3-F12) | `default` |
| Form submission | Dialog footer, card footer, or `UnsavedChangesBar` | `primary` |

Within a group, order buttons from least to most important, left to right, so the primary is rightmost: **Cancel, then Confirm**. Header example: Roll back…, Restart, **Deploy**.

## Verbs

| Verb | Means | Trigger | Dialog title and submit |
| --- | --- | --- | --- |
| **New / Create** | Make a new object | "+ New service" | "Create service" |
| **Add / Attach** | Relate existing things | "+ Attach volume", "Add member" | "Attach volume", "Add member" |
| **Delete** | Destroy the object | "Delete project" | "Delete Commerce Platform?" → "Delete project" |
| **Remove** | Detach without destroying | "Remove from team" | "Remove Jamie Chen?" → "Remove" |
| **Revoke** | End a credential or grant | "Revoke" | "Revoke API key GitHub Actions?" → "Revoke key" |
| **Edit** | Change an existing object | "Edit route" | "Edit route" → "Save changes" |
| **Save changes** | Persist a draft | — | Everywhere. Password: "Update password" (A2-D7) |
| **Deploy, Roll back, Restart, Drain node, Resume scheduling, Stop** | Operational actions | Named by **what will happen**, never by current state (A1 P0-09) | |

Sources: A3-S11, A3-S12, A3 B52, and A6's review of A5-L3 ("+ Attach volume" keeps its `+`).

- **`+` goes on create and attach triggers only.** It never goes on a submit button (A3-C05).
- An ellipsis means a choice follows ("Roll back…").
- Labels are sentence case and name the object when that is ambiguous ("Delete project", not "Delete").

## Disabled and unavailable actions

1. **Prefer enabled, then explain on click.** Submit buttons stay enabled. On click, validate and focus the first problem (A3-C07, A4-Q19).
2. **Disable only when an action is impossible here and now.** Then say why, next to the control or in a tooltip that opens on focus: "Used by 2 routes", "Available after you create a service", "Remove the 3 routes using this domain first" (A1 P2-17, A2-M23).
3. **Hide** actions the user's role can never perform. The server enforces permissions anyway. Don't show a disabled button that would never become enabled.
4. **Block** destructive actions that would break dependents, and explain how to unblock them (see [Destructive actions](destructive-actions.md#blocked-deletes)).

Disabled styling is described in [Buttons](../components/buttons.md#disabled).

## Feedback after an action

| Outcome | Feedback |
| --- | --- |
| Pending | `Button loading` (spinner, disabled, `aria-busy`). No page-level spinner |
| Success, visible on the page | The change itself (a new row, a new status). Optionally a toast |
| Success, not visible (copied, sent, saved elsewhere) | A success toast ("API key copied.") |
| Failure of a header or row action | A danger toast, so the layout doesn't shift (A1 P2-15) |
| Failure inside a dialog | An `InlineNotice tone="danger"` at the top of the dialog body. The dialog stays open |
| Field-level failure | Inline under the field (see [Forms](forms-and-saving.md#validation)) |

## Authorization

UI visibility is **not** authorization (AGENTS.md). Every action that is hidden or disabled for a role must also be rejected by the server action, which checks organization, project, and environment ownership and records an audit entry. Design for both. The UI shows only what can succeed, and the server rejects everything else.
