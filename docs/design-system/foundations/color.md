# Color

Source of truth: `src/app/globals.css`. Values are declared once on `:root` with `light-dark()` and exposed to Tailwind through `@theme inline` as `--color-*`. Use the utilities (`bg-surface`, `text-ink-muted`, `border-line-strong`, and so on), never the raw values.

> **Enforced.** `bower/named-type-scale` in `eslint.config.mjs` rejects any color utility (`bg-`, `text-`, `border-`, `ring-`, `fill-`, `stroke-`, …) whose token isn't declared in `@theme`. Adding a color therefore means adding a token. See [Theming](theming.md#adding-or-changing-a-token).

## Color roles

| Role | Tokens | Use for |
| --- | --- | --- |
| Surfaces | `canvas`, `surface`, `sunken` | Page background, cards and controls, recessed areas |
| Lines | `line`, `line-strong` | Dividers and card borders. Control borders and scroll thumbs |
| Ink (text) | `ink`, `ink-soft`, `ink-muted`, `ink-faint` | Text hierarchy. `ink-faint` is never text |
| Brand | `brand-50` … `brand-900`, `brand-950`, `link` | Primary action, selection, links, focus |
| Success | `ok-50`, `ok-200`, `ok-500` | Healthy, Succeeded, Active, Verified |
| Warning | `warn-50`, `warn-200`, `warn-500` | Needs attention: Draining, Restart pending, the "last deploy failed" marker |
| Danger | `danger-50`, `danger-200`, `danger-500`, `danger-600` | Failed, Failing, errors, destructive actions |
| Info | `info-50`, `info-200`, `info-500` | **Rolled back only** |

## Token reference

Hex values are computed from the HSL declarations. Contrast is measured against `surface`. The minimum is 4.5:1 for body text and 3:1 for large text and non-text UI.

### Surfaces and lines

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F1F3F3` | `#0E1515` | Page background, behind cards. Header bar at 85% opacity |
| `surface` | `#FFFFFF` | `#151D1E` | Cards, dialogs, menus, controls, sidebar |
| `sunken` | `#F6F8F8` | `#111718` | Table header rows, card footers, dialog footers, read-only and disabled fields, tile icons |
| `line` | `#E3E7E8` | `#273435` | Card and table borders, dividers, meter tracks, the default `border-color` |
| `line-strong` | `#CFD6D8` | `#354446` | Borders of inputs, selects, textareas, checkboxes, and avatars. Hover border on default buttons. Unchecked switch. Scrollbar thumb |

`sunken` is lighter than `canvas` in light mode. That is intentional: it reads as recessed inside a white card. It also means **a `sunken` hover is invisible on the canvas**, so ghost buttons hover with `bg-ink/5` instead.

### Ink

| Token | Light | Contrast | Dark | Contrast | Use |
| --- | --- | --- | --- | --- | --- |
| `ink` | `#0D1517` | 18.5 | `#E2E9E9` | 13.9 | Headings, primary text, values |
| `ink-soft` | `#3F5155` | 8.3 | `#AFBFC0` | 9.0 | Body text in cells and descriptions, secondary buttons, menu items |
| `ink-muted` | `#5D6C6F` | 5.5 | `#819498` | 5.4 | Hints, metadata, timestamps, placeholders, table headers, disabled text |
| `ink-faint` | `#9DABAE` | 2.4 | `#839295` | 5.3 | **Non-text only**: decorative icons, status dots for neutral tone, chevrons, separators |

> **Enforced.** `bower/no-faint-text` reports `text-ink-faint` on text elements (`p`, `span`, `td`, `label`, …) unless they are `aria-hidden`. Bower's `ink-muted` is deliberately darker than the prototype's `#75878B` so that it passes AA.

### Brand

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `brand-50` | `#EEF6F5` | `#192E2C` | Active nav item fill, menu and select item focus, active tab count pill |
| `brand-100` | `#D3E9E5` | `#213B37` | 3px focus halo on fields, `::selection` background, chip border for the `brand` tone |
| `brand-200` | `#A7D3CB` | `#325D57` | "Allocated" segment of the node capacity bar |
| `brand-300` | `#6DB6AC` | `#488E85` | Avoid. 2.4:1 on white fails as a focus color (linted) |
| `brand-400` | `#2C8C7F` | `#2C8C7F` | Rarely used; prefer 500 |
| `brand-500` | `#0E6C60` | `#59C0B2` | Primary button fill, focus ring, focused field border, checked controls, active tab underline, meters, "used" bar segment |
| `brand-600` | `#0B5B50` | `#6BC7BB` | Primary button hover |
| `brand-700` / `link` | `#08443D` | `#59C0B2` | Primary button active, links (`text-link`), active nav text, `brand` chip text |
| `brand-900` | `#052925` | `#ACD2CD` | Reserved |
| `brand-950` | `#0B1915` | (same) | Auth and sign-in page background. A fixed color that doesn't change with the theme |

The light-mode primary `brand-500` gives 6.3:1 with white text, practically the prototype's `#0E6E62`.

### Status families

| Family | 50 (fill) | 200 (border) | 500 (text, dot, fill) | 600 |
| --- | --- | --- | --- | --- |
| `ok` | `#EDF8F1` / `#172B1F` | `#BADEC9` / `#366349` | `#166939` / `#79D29E` | — |
| `warn` | `#FEF4E7` / `#2E2419` | `#F6D7AC` / `#8F693D` | `#B35309` / `#EC7F13` | — |
| `danger` | `#FDEAE8` / `#2E1A19` | `#F5C3BD` / `#8F443D` | `#B42318` / `#EB7870` | `#901C14` / `#E6574C` |
| `info` | `#F1EEFC` / `#231F33` | `#D5CBF6` / `#564785` | `#6A43C7` / `#8566CC` | — |

Values are light / dark. In light mode, each 500 text on its 50 fill passes AA: ok 6.2, warn 4.6, danger 5.7, info 5.7. Each 500 on `surface` is between 5.0 and 6.7.

## Tones

`src/lib/tone.ts` defines the six tones that every chip, notice, toast, and banner uses. **Use a tone, not individual color classes.**

| Tone | Classes (`toneClasses`) | Dot | Means |
| --- | --- | --- | --- |
| `neutral` | `border-line bg-sunken text-ink-soft` | `bg-ink-faint` | In progress (with a spinner), stopped, completed, drained, unknown, static labels |
| `brand` | `border-brand-100 bg-brand-50 text-brand-700` | `bg-brand-500` | Selection and brand emphasis. **Never a status** |
| `success` | `border-ok-200 bg-ok-50 text-ok-500` | `bg-ok-500` | Healthy, Succeeded, Running, Active, Verified, Applied |
| `warn` | `border-warn-200 bg-warn-50 text-warn-500` | `bg-warn-500` | Needs attention: Draining, Restart pending, Undeployed changes, a meter at 85% or more |
| `danger` | `border-danger-200 bg-danger-50 text-danger-500` | `bg-danger-500` | Failed, Failing, Unhealthy, Lost, Error, a meter at 100% |
| `info` | `border-info-200 bg-info-50 text-info-500` | `bg-info-500` | **Rolled back**, and nothing else |

The `InlineNotice` and toast APIs also accept `error` (meaning `danger`) and `warning` (meaning `warn`) as aliases. Prefer the canonical names in new code.

## Overlays, transparency, and special values

| Value | Where | Why |
| --- | --- | --- |
| `bg-ink/25` | Dialog and alert-dialog backdrop | A tinted backdrop matches the palette better than black |
| `bg-ink/5` | Ghost button and icon button hover | Visible on both `canvas` and `surface` |
| `bg-canvas/85` + `backdrop-blur-md` | Sticky header bar | Content scrolls beneath it |
| `color-mix(in srgb, var(--ink) 16%, transparent)` | `.scroll-horizontal` and `.scroll-vertical` edge shadows | Scroll cues that follow the theme |
| `text-white` | Text on solid `brand-500` and `danger-500` buttons, checked checkbox tick | Allowed (`white` is a lint-allowed keyword) |
| `bg-white` | Switch thumb | Allowed |
| `::selection` | `brand-100` background, `brand-700` text | Global, in `globals.css` |

Don't use `black` and other generic keywords for new UI. Two dismiss buttons still use `hover:bg-black/5`; see [known issues](../records/known-issues.md).

## Rules

**Do**
- Pick the tone from `statusDefinition()` (`src/lib/status.ts`) for anything that is a status.
- Use `text-link` (or `.text-link`) for links. It underlines on hover and has its own focus ring.
- Use `text-danger-500` for inline field errors and `danger` tones for destructive affordances.
- Use `ink-muted` for every piece of secondary text, including timestamps, hints, and table headers.

**Don't**
- Use brand teal to mean healthy or success. Green (`ok`) means that.
- Use `info` (purple) for anything except "Rolled back": not for in-progress, system activity, or the "allocated" bar.
- Use `warn` for work in progress. Amber means someone should look.
- Add `bg-[#…]`, `text-gray-500`, `bg-surface-raised`, or any other undeclared color. Lint fails.
- Use `opacity-50` to show a disabled state. See [Buttons](../components/buttons.md#disabled).

## Dark theme notes

Dark values are tuned for the dark surfaces: brand and status 500s become lighter, and 50 fills become dark tints. The dark theme is **not fully verified** (decision A4-Q38), and a few combinations are known to fail contrast:

- White text on dark `brand-500` and `danger-500` buttons measures about 2.2:1 and 2.8:1.
- The `info` chip text on its fill measures about 3.6:1.
- Dark `ink-faint` (5.3:1) is almost the same as `ink-muted`, so it is not actually faint.

These are tracked in [known issues](../records/known-issues.md#dark-theme). Fix them at the token level, not per page.
