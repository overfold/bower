# Buttons

Source: `src/components/ui/button.tsx`. Regression tests: `src/lib/button.test.ts`, `src/lib/ui-contracts.test.ts`.

## `Button`

```tsx
<Button variant="primary" size="sm" loading={pending}>
  <Plus />
  New service
</Button>
```

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `primary` · `default` · `ghost` · `danger` · `destructive` · `link` | `default` |
| `size` | `sm` (32px) · `md` (36px) · `lg` (44px) · `icon` (32px square) | `md` |
| `loading` | boolean. Disables the button, sets `aria-busy`, and shows a spinner before the label | — |
| `asChild` | Renders the child (for example a Next `<Link>`) with button styling. Use it for navigation | — |

### Variants

| Variant | Looks like | Use for |
| --- | --- | --- |
| `primary` | Solid `brand-500`, white text. Hover `brand-600`, active `brand-700` | **The one main action** in a card, dialog, or page header: Deploy, Create service, Save changes, Clear filters (in a filtered-empty state), Roll back (on a failed deployment) |
| `default` | `surface` with a `line` border. Hover darkens the border and fills `sunken` | Secondary actions: Cancel, Restart, Roll back… (on a healthy release), Redeploy, Edit, Paste .env, row action buttons ("View logs") |
| `ghost` | Text only, `ink-soft`. Hover `bg-ink/5` | Low-emphasis or toolbar actions, pagination (with `text-brand-700`) |
| `danger` | `surface` with a `danger-200` border and `danger-500` text | **Opens** a destructive flow: "Delete project", "Remove from organization" |
| `destructive` | Solid `danger-500`, white text. Hover `danger-600` | **The final confirmation** of a destructive flow only. It is the default style of `AlertDialogAction` |
| `link` | `brand-700` text that underlines on hover | An inline action that reads like a link |

Choosing:
- **At most one `primary` per card or dialog** (A3-C04). A page header has one primary at most. On the deployment page, the header actions are all `default`, except "Roll back to {last good}" on a failed deployment, which is primary (A5-L12, A3-F21).
- A recovery action's confirmation, such as **rollback**, uses `primary`, not red (A3-F02).
- Use `danger` to open and `destructive` to confirm. Never put a solid red button directly on a page (A3-C06, A5-M11).

### Sizes

| Size | Height | Text and icon | Use |
| --- | --- | --- | --- |
| `sm` | 32px | 13px, 14px icons | Card-header actions, dialog footers, table rows, toolbars, pagination |
| `md` | 36px | 13px, 16px icons | Page-header actions, forms, auth pages (full width) (A4-Q66) |
| `lg` | 44px | 13px, 16px icons | Rare. Large standalone calls to action |
| `icon` | 32×32 | 16px icon | Prefer `IconButton`, which forces a label |

### States

| State | Treatment |
| --- | --- |
| Hover | Defined per variant (above) |
| Active | 1px press (`active:translate-y-px`). Primary goes to `brand-700` |
| Focus | `ring-2 ring-brand-500 ring-offset-2 ring-offset-surface` |
| Loading | Spinner + label, disabled, `aria-busy`. Keep the label. Change it to an "-ing" form only if the action takes a while ("Deploying…") |
| Disabled | See below |

### Disabled

A disabled button looks **neutral**, never a faded version of its color (A4-Q18, A5-H1):

- Solid buttons (`primary`, `destructive`) and `default`: `bg-sunken`, `border-line`, `text-ink-muted`.
- `ghost` and `link`: muted text only, no box. A disabled ghost button must not look more clickable than an enabled one.
- Never use `opacity-*` for disabled states. That includes switches, tabs, and menu items, which use `text-ink-muted` and `cursor-not-allowed`.

**When to disable.** Prefer keeping submit buttons enabled and validating on click (A3-C07, A4-Q19). Disable only when the action is impossible in the current state, and explain why with a tooltip that also opens on focus, or a short inline reason ("Used by 2 routes", "Available after you create a service"). Two exceptions keep a submit gate:

- Type-to-confirm deletion: the button is disabled until the typed slug matches.
- While a request is pending (`loading`).

### Icons in buttons

- Put the icon **before** the label, as a bare Lucide component (`<Plus />`). Size and gap are automatic. Don't add size or margin classes.
- Use `Plus` on **create triggers only** ("New service", "Invite people", "Attach volume"). Never on the dialog's submit button ("Create service") (A3-C05).
- Keep the rest of the icon vocabulary consistent: `Rocket` for Deploy, `RotateCcw` for Roll back, `RefreshCw` for Restart, `Trash2` for delete (see [Iconography](../foundations/iconography-and-brand.md#actions)).

## `IconButton`

```tsx
<IconButton label="Copy full ID" onClick={copy}><Copy /></IconButton>
```

A 32×32 ghost-style square. `label` is **required** and becomes both `aria-label` and `title`. Use it for copy, close, reveal, edit-row, full-screen, and row menu triggers.

A **single destructive row action** (for example the trash icon) is neutral at rest and turns red on hover (A3-C02). Rows with two or more actions use `RowActions` instead (see [Tables](tables.md#row-actions)).

## Labels

- Use sentence case with a specific verb and object: "Create service", "Invite people", "Roll back to v2.3.0", "Save changes", "Update password".
- Save buttons read **"Save changes"** everywhere. The password form uses **"Update password"** (A2-D7).
- An ellipsis (…) means the button opens a choice before acting: "Roll back…", "Deploy…" in the palette.
- See [Actions and hierarchy](../patterns/actions-and-hierarchy.md) and [Content and copy](../patterns/content-and-copy.md#verbs) for the verb rules.

## Don't

- Build clickable `div`s or `span`s. Use `Button`, `IconButton`, or a link.
- Nest a `<button>` inside an `<a>`. Use `asChild`.
- Use `hover:brightness-*` or opacity for hover (A1 P3-03).
- Show a state in a button label ("Draining", "Follow off"). Buttons name the action ("Drain node", "Resume scheduling"), and state belongs in chips or switches (A1 P0-09, A2-M12).
