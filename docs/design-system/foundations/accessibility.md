# Accessibility

Bower targets **WCAG 2.2 AA**. Most of the work is built into the primitives. Your job is to use them correctly and not undo them.

## Focus

There are two focus styles, both at or above 3:1 contrast (A2-A3, A3-T03, A4-Q17):

| Element | Focus style |
| --- | --- |
| Buttons, icon buttons, links, nav items, tabs, switches, breadcrumbs, row links | `focus-visible:ring-2 ring-brand-500 ring-offset-2 ring-offset-surface` (2px ring, 2px offset) |
| Inputs, selects, textareas, checkboxes | `focus-visible:border-brand-500` plus `ring-[3px] ring-brand-100` (a soft halo) |
| Invalid fields | `border-danger-500` plus `ring-danger-200` in every state, including focus |
| Clickable table rows, tiles | `ring-2 ring-inset ring-brand-500` (inset so the ring isn't clipped by the card) |
| `.text-link` | `outline: 2px solid brand-500; outline-offset: 2px` |

- Always use `focus-visible`, not `focus`, so that mouse users don't see rings (A1 P0-07).
- Never use `outline-none` without a replacement ring.

> **Enforced.** `bower/no-low-contrast-focus` rejects `ring-brand-100` and `ring-brand-300`, and `border-brand-300` for focus, unless they are part of the complete field-focus recipe (3px `brand-100` halo together with a `brand-500` border).

## Keyboard

- **Skip link:** the first focusable element in the dashboard is "Skip to content", which targets `#main-content`.
- **Dialogs** trap focus, close on Esc, and restore focus on close (Radix). `DialogContent` focuses the **first field** on open, not the close button (A1 P0-07).
- **Clickable rows** (`ClickableTableRow`, `DeploymentsTable`) are focusable with `role="link"` and an `aria-label`, and open on Enter. The primary name inside is also a real `<a>`, so middle-click and "open in new tab" work.
- **Popovers that explain status** (the failing-service chip) open on click and keyboard, never on hover only (A3 B04).
- **Tooltips** explaining a disabled control must be reachable by focus. Where space allows, prefer a short inline reason (A2-M23).
- **Command palette:** ⌘K or Ctrl+K anywhere. Arrow keys move through results and Enter opens one. Places rank above actions, and an action is never pre-selected while a place matches (A5-H2).
- **Scrollable tables** become a focusable `region` labelled by their card title only when they overflow, so they don't add an invisible tab stop (A5-H7).

## Contrast

- Text: `ink`, `ink-soft`, and `ink-muted` all pass 4.5:1 on `surface` and `canvas` in light mode. `ink-faint` (2.4:1) is never text (linted).
- Form-control borders use `line-strong` so empty fields are visible.
- Chip text on its tinted fill passes 4.5:1 in light mode for every tone.
- Disabled controls use the sunken fill and muted text instead of opacity, so they stay legible (A4-Q18).
- Dark-theme exceptions are listed in [Color › Dark theme notes](color.md#dark-theme-notes).

## Don't rely on color alone

- Status chips always include a **word** ("Failing"), not just a dot (A2-H2).
- Meters carry an `aria-label` ("CPU 13%") and a visible percentage or value.
- Log levels are colored only for WARN and ERROR, and the level text stays visible.
- Required versus optional fields: optional fields say "(optional)" in their label (A2-F4).
- Diff rows use the words Added, Changed, and Removed, and an arrow (`old → new`) with a muted old value. They don't use strikethrough color alone.

## Names, labels, and structure

- Every form control has a visible `Label` with `htmlFor` matching the control's id. Placeholders are not labels. Search fields are the exception: they carry the scope in `aria-label`, and the placeholder is just "Search".
- Hints and errors are linked with `aria-describedby`. Invalid fields set `aria-invalid="true"`.
- Every dialog has a `DialogTitle`, and usually a `DialogDescription`.
- Icon-only controls use `IconButton label="…"`, which sets both `aria-label` and `title`. Row menus are labelled "Actions for {name}".
- Every actions column has a visually hidden header (`<span className="sr-only">Actions</span>`) (A4-Q56).
- Each page has exactly one H1, and headings follow the outline. Status chips sit **beside** the H1, not inside it, so the heading's accessible name stays clean (A5-H4).
- Navigation landmarks are labelled: "Main navigation", "Breadcrumb", "Project", "Service configuration", "Personal settings", and so on. The active item has `aria-current="page"`.

## Live regions

| Component | Role |
| --- | --- |
| Toasts | Container `aria-live="polite"`. Each toast is `role="status"`, or `role="alert"` for danger |
| `InlineNotice`, `PageBanner` | `role="status"`, or `role="alert"` for danger |
| `FieldError` | `role="alert"` |
| `UnsavedChangesBar` | `role="status"` |
| `Skeleton` | `role="status"` with "Loading…" `sr-only` text. Page skeletons set `aria-busy` |
| `Button loading` | `aria-busy`, disabled, with a spinner (`aria-hidden`) |

## Motion

All animation respects `prefers-reduced-motion` (see [Motion](motion.md#reduced-motion)).

## Testing checklist

- Tab through the whole change. Every interactive element is reachable and shows a visible focus ring, and the order follows the layout.
- Open and close each dialog with the keyboard only. Focus lands on the first field and returns to the trigger.
- Use a screen reader or the accessibility tree to check names for icon buttons, row links, tables, and dialogs.
- Check both themes and a 390px-wide viewport.
- Run `npm run lint`. The focus and faint-text rules catch the most common regressions.
