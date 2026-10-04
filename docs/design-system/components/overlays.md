# Overlays

Sources: `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tooltip.tsx`, `src/components/command-palette.tsx`, `src/components/exec-dialog.tsx`.

All overlays are Radix primitives. They are portalled, so cards never clip them. They trap focus where appropriate, close on Esc, and restore focus on close. Surfaces are `bg-surface border-line rounded-xl shadow-pop`.

## Choosing an overlay

| Need | Use |
| --- | --- |
| A form, or a task with several fields | `Dialog` |
| Confirm one consequential action | `AlertDialog` |
| A list of actions on an object | `DropdownMenu` (`RowActions` for table rows) |
| An interactive explanation (with buttons or links) anchored to something | `Popover` |
| A short, non-essential label or explanation | `Tooltip` |
| Jump anywhere or run a common action | Command palette (⌘K) |

## Dialog

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><Button variant="primary" size="sm"><Plus />New service</Button></DialogTrigger>
  <DialogContent size="md">
    <DialogHeader>
      <DialogTitle>Create service</DialogTitle>
      <DialogDescription>…only if it adds information…</DialogDescription>
    </DialogHeader>
    <form onSubmit={…}>
      <DialogBody className="space-y-4">…fields…</DialogBody>
      <DialogFooter>
        <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="primary" type="submit" loading={pending}>Create service</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### Sizes

Use the `size` prop. Don't set width classes (A1 P2-21, A3-C11).

| `size` | Max width | Use for |
| --- | --- | --- |
| `sm` | 28rem (448px) | Confirmations, one-field dialogs |
| `md` (default) | 36rem (576px) | Ordinary forms: create service, create project, invite people, add secret |
| `lg` | 42rem (672px) | Editors and long forms: variables, routes, deploy review, rollback with a diff |

The **terminal** is the one established exception: a large `max-w-6xl` panel with a full-screen mode.

### Anatomy and behavior

- **Header** (`DialogHeader`): title (`text-md font-semibold`), an optional description (`text-sm text-ink-muted`), and a built-in ✕ close button on the right. The header has a bottom border.
- **Body** (`DialogBody`): `px-4 py-4 sm:px-5`. It scrolls at `max-h-[62vh]` with top and bottom scroll shadows (`.scroll-vertical`) so overflow is visible (A5-M12).
- **Footer** (`DialogFooter`): `bg-sunken` with a top border. Buttons are right-aligned, **Cancel first, then the primary action**, and stack full width below `sm`.
- **Position:** pinned near the top (`top-3`, `sm:top-8`), so the dialog grows downward and doesn't jump as fields appear (A5-M12).
- **Initial focus:** the first input, textarea, or combobox, not the ✕ (A1 P0-07). Override `onOpenAutoFocus` only to pick a different field.
- **Motion:** backdrop `bg-ink/25` fades in over 150ms. The panel scales from 0.97 and rises 8px over 220ms (opacity only under reduced motion).
- **Titles name the action and object:** "Create service", "Attach volume", "Roll back Storefront?", "Terminal · storefront-alloc-1". After a one-time secret is created, the title changes to the result ("API key created") (A1 P1-15).

## AlertDialog

For confirmations. It has the same surface and motion as `Dialog`, but is **centered** and `sm` by default.

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="danger">Delete project</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Commerce Platform?</AlertDialogTitle>
      <AlertDialogDescription>Deletes 3 services, 2 routes, 2 volumes, all secrets and deployment history. This can't be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <div className="px-4 sm:px-5">…type-to-confirm field, if required…</div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction disabled={!confirmed}>Delete project</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- `AlertDialogHeader` includes a ✕ close button for consistency with dialogs (A3-C12).
- `AlertDialogAction` defaults to the **`destructive`** style. For non-destructive confirmations (rollback, deploy, restart), pass `className={buttonVariants({ variant: 'primary' })}`, or use a `Button` (A3-F02).
- Title: a question naming the object ("Remove Jamie Chen?"). Description: the consequence, and for people, their email (A3-S13).
- See [Destructive actions](../patterns/destructive-actions.md) for confirmation content.

## DropdownMenu

A `rounded-xl` surface with `p-1.5`. Items are `rounded-lg px-2 py-1.5 text-sm text-ink-soft`, with focus `bg-brand-50 text-ink`, and disabled items use `text-ink-muted` with `cursor-not-allowed`.

- Item labels are verbs ("Rename", "Drain node", "Remove from team").
- A destructive item goes last, after `DropdownMenuSeparator`, in `text-danger-500`, and opens a confirmation.
- `DropdownMenuLabel` for group titles. `DropdownMenuShortcut` for key hints.
- Uses: `RowActions`, profile menu, org picker, breadcrumb overflow ("…").

## Popover

`w-72 rounded-xl p-4 shadow-pop` by default. Use it when the explanation contains **actions or links** and must work with the keyboard. The failing-service popover is the reference (see [Status and feedback](status-and-feedback.md#interactive-status-chip)). Triggers must be real buttons with `aria-haspopup`.

## Tooltip

`rounded-lg bg-ink px-3 py-1.5 text-xs text-canvas shadow-raised` (inverted colors).

- Use for: icon-button labels (automatic via `title` on `IconButton`), full timestamps (the `Time` title), Trellis terms behind ⓘ, the reason a control is disabled, truncated text.
- A tooltip must never hold the **only** copy of essential information, or an action. Disabled reasons must also be reachable by focus (A2-M23).
- Wrap groups in `TooltipProvider`.

## Command palette

`src/components/command-palette.tsx`. It opens with ⌘K or Ctrl+K, or from the "Search ⌘K" button in the header.

- **Empty query:** **Recent** (up to 5 places, per user), then **Go to** (Home, Projects, Deployments, Status, Audit log, Settings), then **Actions** (A3-N19, A4-Q32).
- **Typing:** grouped results with their headers kept. **Places rank above actions**, and an action is never pre-selected while a place matches, so Enter never starts a deploy by accident (A5-H2).
- Each row has a **type icon** (project, service, page, action) and no "Page" subtitle. Services show their project: "Storefront · Commerce Platform".
- Actions use an ellipsis when they open a choice ("Deploy Storefront…", "New project", "Invite people").
- No match shows **"No results for "…""** only (A3-N20).
- The list height is `max-h-[min(60vh,480px)]`.

## Terminal

`ExecDialog` (`src/components/exec-dialog.tsx`) is a large panel with a full-screen toggle (A3-C25).

- Title: "Terminal · {allocation}". The full-screen `IconButton` sits beside ✕ (A4-Q63). There is 16px of padding under the terminal and a status footer.
- xterm draws to canvas, so it resolves the JetBrains Mono family from CSS variables and waits for the font to load before measuring (A3 B06).
