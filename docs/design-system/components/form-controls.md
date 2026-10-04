# Form controls

Sources: `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`, `label.tsx`, `search-input.tsx`, and `feedback.tsx` (`FieldError`). Contracts: `src/lib/ui-contracts.test.ts` ("controls use the radius scale, strong borders, and invalid focus overrides").

For how forms validate and save, see [Forms and saving](../patterns/forms-and-saving.md).

## Shared control contract

Every text-like control (`Input`, `Textarea`, `SelectTrigger`) shares this contract:

| Aspect | Value |
| --- | --- |
| Height | 36px (`h-9`). `Textarea` has a minimum of 60px and can grow with `[field-sizing:content]` |
| Shape | `rounded-lg` (8px), `border border-line-strong`, `bg-surface`, **no shadow** |
| Text | `text-sm text-ink`. Placeholder `text-ink-muted` |
| Focus | `border-brand-500` plus a `ring-[3px] ring-brand-100` halo |
| Invalid (`aria-invalid="true"`) | `border-danger-500` plus `ring-danger-200`, **including while focused** |
| Disabled | `border-line bg-sunken text-ink-muted` (no opacity) |
| Read-only (for example a slug) | `readOnly` plus `className="bg-sunken"`, with `mono` if the value is copyable |

## Field anatomy

```tsx
<div className="space-y-2">
  <Label htmlFor="image">Image</Label>
  <Input id="image" mono aria-invalid={Boolean(error)} aria-describedby="image-help" />
  <p id="image-help" className={cn('text-xs', error ? 'text-danger-500' : 'text-ink-muted')}>
    {error ?? 'Use a registry/repository image reference with a tag or digest.'}
  </p>
</div>
```

1. **Label** above the control (`Label`, `text-sm font-medium`).
2. **Control.**
3. **Hint** under the control (`text-xs text-ink-muted`), about 8px below (A4-F34). When the field is invalid, the **error replaces the hint** in `text-danger-500`, linked with `aria-describedby` (A4-Q60).

Hints sit **below** the control, never beside it and never above it (A1 P2-11). The prototype put hints above. Bower doesn't.

For a field with no hint, render `FieldError` (`text-xs text-danger-500`, `role="alert"`) only when there is an error.

## `Label`

```tsx
<Label htmlFor="rate-limit" optional>Rate limit</Label>   // renders "Rate limit (optional)"
```

- Every control has a visible label with `htmlFor`.
- Mark **optional** fields with the `optional` prop. Required fields aren't marked (A2-F4).
- To explain the field, use an `Info` icon with a tooltip after the label (for example, Port explains where its default came from) (A2-F3).

## `Input`

- `mono` switches to JetBrains Mono at 12.5px. Use it for images, hostnames, keys, paths, and tokens.
- **Units go inside the field as a suffix**, not in the label (A2-F2, A2-M13):

  ```tsx
  <div className="relative">
    <Input id="cpu" type="number" className="pr-14" … />
    <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">cores</span>
  </div>
  ```

  Put the limits in the hint: "Up to 8 cores per replica".
- **Joined inputs**, such as the hostname prefix plus its domain select, look like one control: the inner edges are square where the two parts meet (A6 review of A5-M12).
- **Placeholders:** in creation and configuration forms, don't use placeholders that look like values or contain rules. Put examples and rules in the hint ("e.g. `^v\d+\.\d+\.\d+$`", "At least 8 characters") (A3-C17, B58). Search fields keep "Search".

## `Textarea`

Same contract as `Input`, plus `leading-relaxed` and `py-2`. Use it for multi-line values: secrets, certificates, notes. Secret values are **masked** by default and have reveal and upload controls (see [Secrets](../patterns/secrets-and-credentials.md)).

## `Select`

Radix Select, styled to match the inputs. **Use `Select` for every set of discrete options**: strategies, health-check types, protection, roles, TLS, and every filter (A1 portal review, A3-L25, A5 "Option controls" kept). Bower doesn't use segmented controls or radio cards for form options.

- `SelectContent` is at least as wide as the trigger and at most `max-w-xs`. Items truncate on one line instead of wrapping (A5-M17).
- In toolbars and card headers, align the menu to the end (`align="end"`) so it doesn't overflow the card (A3 B71).
- To explain the **chosen** option, show a hint under the select that updates with the choice ("Replaces replicas one at a time. No downtime.") (A3-C18). When options need context, an option can carry a one-line description, as the Grant access roles do (A5-L7).
- Options that are copyable values (secret keys) render in mono (A5-M14).
- Keep option order identical everywhere a set appears. Deployment strategies are always Rolling, Recreate, Blue/green, Canary, with **Rolling** as the default (A3-F22, B41).
- The select ignores the programmatic `change` events it fires itself, so resetting a form doesn't mark it dirty again (A1 portal review).

## Checkbox and Switch

| Control | Use for | Notes |
| --- | --- | --- |
| `Checkbox` | **Booleans in forms** that are saved (read-only mount, team selection, "I understand"), and multi-select lists | 16px, `rounded-sm` (4px) so it can't be mistaken for a radio button, `border-line-strong`. Checked: `brand-500` fill with a white tick |
| `Switch` | **Live view toggles** that apply immediately and aren't saved: log Follow and Wrap | 36×20 track: `brand-500` when on, `line-strong` when off. Always pair it with a visible label (A2-D5) |

The rule comes from A3-C13: checkbox in forms, switch for live toggles. Never put state in a button label ("Follow off").

For choosing many items from a long list (teams when inviting), use a multi-select with chips (A3-C14).

## `SearchInput`

```tsx
<SearchInput value={query} onChange={…} aria-label="Search services and images" />
```

- Has a leading search icon (`ink-faint`, decorative) and a clear button (✕) once there is text. The browser's native cancel button is hidden globally (A5-M16).
- Placeholder: **"Search"**. Put the scope in `aria-label` (A4-Q59, A5-M16).
- Grows to fill the toolbar (`flex-1`), with a minimum width of 240px.
- Clearing focuses the input and fires a normal `input` event, so controlled filters update.
- Show filter controls only when the list is long enough to need them: Projects above 8 items, Members above 10 (A3-L07, A1 P1-11). Always show search on pages built for searching (Deployments, Audit log).

## Date and time

There is no custom date picker. For expiry, offer **preset durations** (1 day, 7 days, 30 days) plus a **date-only** field for Custom (A3-C16). Don't use native `datetime-local`.

## Don't

- Add `shadow-*` to controls (A1 P3-06).
- Use `border-line` on controls. It is too faint (A3-T02).
- Use `focus:` instead of `focus-visible:`, or a `brand-300` focus border. Lint rejects the latter.
- Hide the label and rely on the placeholder.
- Show an error in a top banner **and** under the field. Field errors go under the field only (A4-Q60).
