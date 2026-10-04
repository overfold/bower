# Motion

Motion in Bower is brief and functional. It confirms that something changed or appeared, and it never delays a task. Most transitions take 150ms.

## Tokens

Declared in `@theme`:

| Token | Value | Use |
| --- | --- | --- |
| `ease-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default for color, border, shadow, and transform transitions on controls. Dialog entrance. Page transition |
| `ease-move` | `cubic-bezier(0.25, 1, 0.5, 1)` | Things that change size or position: meter fill width, the sliding tab underline |
| `animate-fade-in` | 400ms ease-out | Rare decorative entrances |
| `animate-slide-up` | 400ms ease-out | Rare decorative entrances |
| `animate-accordion-down` / `-up` | 200ms | Radix collapsible height |

The overlay enter and exit utilities (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`) come from `tw-animate-css`, which is imported in `globals.css` (A5-L8). Without that import these classes silently do nothing.

## Durations

| Duration | Use |
| --- | --- |
| 150ms (`duration-150`) | Hover and active colors, borders, focus rings, switch thumb, dialog backdrop fade |
| 180ms | Route content fade (`PageTransition`: opacity, plus a 4px rise) |
| 220ms | Dialog and alert-dialog entrance (`motion`: opacity, scale 0.97 → 1, y 8 → 0). Tab underline slide |
| 300ms | Meter width changes |
| 1.6s | The pulse ring on `Dot pulse` (rarely used) |

## Patterns

- **Buttons** press down 1px on `:active` (`active:translate-y-px`) and transition their background, border, color, shadow, and transform.
- **Tab underline** is a `motion.span` with a `layoutId`, so it slides between tabs instead of jumping.
- **Toasts** fade and rise 6px in over 200ms (`animate-in fade-in-0 slide-in-from-bottom-[6px] ease-enter`) and fade out over 150ms. The toast stays in the list as `closing` until the exit finishes, and under reduced motion it is removed at once.
- **Dialogs** use `AnimatePresence` for both enter and exit. Menus, selects, popovers, and tooltips use the `tw-animate-css` data-state classes (fade and a slight zoom, sliding in from the trigger's side).
- **Loading:** `Skeleton` uses `animate-pulse` and stops under reduced motion. Spinners (`Loader2 animate-spin`) mean "work in progress right now". Use them only in pending buttons and in-progress status chips, never for completed history (A3 B13).
- **Sign-in background:** `GrowingTrellis` draws vines once per visit, stores its growth state in `localStorage`, and renders the final state immediately under reduced motion.

## Reduced motion

`globals.css` sets every animation and transition to about 0ms under `prefers-reduced-motion: reduce`. Components that use the `motion` library also check `useReducedMotion()` and fall back to an opacity-only fade (dialogs, page transitions, command palette). New animated components must do both:

1. Rely on the global CSS override for CSS animations.
2. In `motion` components, branch on `useReducedMotion()` and drop transforms.

## Don't

- Animate layout on hover (no growing cards or moving rows).
- Use spinners for anything that isn't actively running.
- Add entrance animations to content that loads on every navigation, beyond the shared `PageTransition`.
- Add bouncy or elastic easing. Use one of the two easing tokens.
