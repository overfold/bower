# Shape and elevation

## Radius scale

Declared in `@theme` (A3-T01, which overrides A2-A2). It is the prototype's 4 / 6 / 8 / 12 scale.

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 4px | Checkboxes (so they never read as radio buttons), small inline icon buttons (search clear, toast dismiss), text-link focus outline |
| `rounded-md` | 6px | Chips and badges, tab count pills, avatars, segmented `TabsTrigger`, page banner dismiss buttons |
| `rounded-lg` | 8px | Buttons, icon buttons, inputs, selects, textareas, menu and select items, nav items, inline notices, toasts, segmented `TabsList` |
| `rounded-xl` | 12px | Cards, dialogs, alert dialogs, menus, select popovers, popovers, the unsaved-changes bar, auth cards |
| `rounded-full` | — | Status dots, meters and their tracks, switches, the active tab underline, scrollbar thumbs |

Rules:
- Don't use `rounded-2xl`, `rounded-3xl`, or arbitrary `rounded-[…]` on components (auth cards were unified to `xl` in A1 P3-05). The one decorative exception is the blurred glow behind the auth card.
- Nested shapes get smaller inward: a card at 12px holds controls at 8px, which hold chips at 6px.
- `Card` uses `overflow-hidden`, so tables and footers inside it follow the rounded corners (A1 P0-03). Menus and selects are portalled, so nothing is clipped.
- Joined controls, such as the hostname prefix with its domain suffix, merge **without** inner rounded corners where they meet (A6 review of A5-M12).

## Borders

| Border | Use |
| --- | --- |
| `border-line` | Cards, tables, dividers, dialogs, menus, toasts, default buttons, tab rails. It is the global default (`* { border-color: var(--line) }`) |
| `border-line-strong` | Form controls (input, select, textarea, checkbox), avatar fallbacks, and the hover border on default buttons. Fields need the stronger edge to be visible: `line` is only 1.25:1 on white (A3-T02) |
| `border-brand-500` | A focused field (with a 3px `brand-100` halo) |
| `border-danger-500` | An invalid field, in every state including focus |
| `border-danger-200` | `danger` button, danger-zone card, danger tone |
| Tone 200s | Chip, notice, and banner borders, via `toneClasses`. Toasts use `border-line` |

Cards are **border only** (A3-T08).

## Elevation

Shadows are reserved for things that **float above the page**. In-page blocks don't get them.

| Token | Value | Use |
| --- | --- | --- |
| `shadow-card` | `0 1px 2px rgba(12,20,22,.04)` | The active segmented `TabsTrigger` only. Don't use it on cards, inputs, or buttons (A1 P3-06, A3 B28) |
| `shadow-raised` | `0 8px 24px -12px …, 0 1px 2px …` | Toasts, the unsaved-changes bar, tooltips |
| `shadow-pop` | `0 18px 48px -20px …, 0 2px 6px …` | Dialogs, alert dialogs, dropdown menus, select popovers, popovers, the command palette, the auth card, the focused skip link |
| `shadow-sm` | Tailwind default | Switch thumb |

The shadow values use the ink hue (`rgba(12,20,22,…)`) rather than black, so they blend with the tinted palette.

## Stacking order (z-index)

| Layer | z-index | Elements |
| --- | --- | --- |
| Header bar | `z-20` | Sticky header |
| Unsaved-changes bar | `z-40` | Floating save bar (portalled to `body`) |
| Overlays | `z-50` | Dialog backdrop and content, menus, selects, popovers, tooltips |
| Notifications and skip link | `z-[100]` | Toast stack, "Skip to content" |
| Local | `z-10` | Links layered over clickable rows, the search icon inside `SearchInput` |

Don't add new z-index values without placing them in this table.
