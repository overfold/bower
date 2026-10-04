# Theming

Bower supports **System**, **Light**, and **Dark** appearance. Theming is done entirely with CSS custom properties. Components never branch on the theme.

## How it works

```css
:root {
  color-scheme: light;
  --surface: light-dark(hsl(0 0% 100%), hsl(186 18% 10%));
  /* … every themable token is one light-dark() pair … */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; }
}

:root[data-theme="dark"] { color-scheme: dark; }
```

- `light-dark(a, b)` resolves to `a` or `b` according to the computed `color-scheme`. Each token is declared **once**, with both values side by side, so light and dark can't drift apart. (The old approach of duplicated theme blocks was removed in A1 P1-01.)
- With no `data-theme` attribute, the OS preference decides (**System**).
- `data-theme="light"` forces light even when the OS prefers dark. `data-theme="dark"` forces dark.
- `@theme inline` maps each `--token` to a Tailwind `--color-token`. Utilities therefore emit `var(--token)` and follow the theme automatically.

### The user control

Settings › Account › **Appearance** (`src/app/(dashboard)/settings/account/appearance-settings.tsx`) is a `Select` with System, Light, and Dark. It writes `localStorage.theme` and sets `document.documentElement.dataset.theme`.

Decision A4-Q38 keeps this control as a plain select on Account and deliberately **not** more prominent (for example, not in the profile menu) while dark mode is not fully tested.

> **Known gap.** Nothing reads `localStorage.theme` when the page loads, so an explicit Light or Dark choice lasts only until the next full page load. After that, the app follows the system setting again. See [known issues](../records/known-issues.md#theming). A fix needs a small blocking script in the root layout that sets `data-theme` before first paint.

## Rules for theme-safe UI

- **Only use tokens.** A token utility is automatically correct in both themes. A hex value, `bg-white` used as a surface, or a default Tailwind color is not.
- **Don't use `dark:` variants.** If something needs a different value in dark mode, it's a token: add or adjust the `light-dark()` pair.
- **Mix colors with tokens for transparency.** `bg-ink/25`, `bg-ink/5`, and `color-mix(in srgb, var(--ink) 16%, transparent)` adapt to the theme. `bg-black/30` does not.
- **Canvas-drawn content resolves variables in script.** The terminal (xterm) and any `<canvas>` or SVG drawing can't read CSS variables directly. Read them with `getComputedStyle(document.documentElement).getPropertyValue('--token')` (see `exec-dialog.tsx`).
- **Brand surfaces that never change**, such as the auth background `brand-950` (`#0b1915`), are declared as a single value in `@theme`. Keep them rare.

## Adding or changing a token

1. Add the `light-dark()` pair to `:root` in `src/app/globals.css`. Use HSL to match the neighboring tokens.
2. Map it in `@theme inline` as `--color-<name>: var(--<name>);`. The ESLint color rule reads this block, so the new utility becomes legal automatically.
3. Check contrast in **both** themes: 4.5:1 for text and 3:1 for UI and focus indicators. Record the values in [Color](color.md#token-reference).
4. If it replaces an older token, migrate every consumer in the same change and delete the old token. Don't keep aliases (A1 P1-01).
5. Add a [changelog](../changelog.md) entry.

## Verifying a theme change

- Toggle System, Light, and Dark in Settings › Account. Also check System with the OS set to dark.
- Inspect the dark captures from the [visual verification](../workflow/visual-verification.md) workflow (Overview and service configuration are captured in dark mode).
- Check focus rings, disabled controls, chips, and solid buttons specifically. Those are the combinations most likely to fail in dark mode.
