# Forms and saving

Control specs are in [Form controls](../components/form-controls.md). This page covers how forms behave.

## Choosing a save model

| Model | Use when | Examples |
| --- | --- | --- |
| **Draft with `UnsavedChangesBar`** | A form edits persisted settings, especially across several cards | Service Configuration (with Variables and Advanced), Settings › Organization, Account profile, Project General |
| **Dialog submit** | Creating or editing one object in a focused task | Create service, Create route, Edit route, New variable, Invite people |
| **Card button** | A single action that isn't a draft | Change password ("Update password", in the card footer) (A3-F10). Member roles (a Save next to the selects) (A4-Q39, A5-M11) |
| **Immediate** | A toggle or row action that takes effect at once and is easy to reverse, or a page with no draft form | Log Follow and Wrap switches. Variables on the **project Environment** page (A4-Q36) |

Never combine models within one form. A field that saves immediately must not sit inside a draft card that looks the same. That is why service Configuration variables are part of the draft (A4-Q36).

## The unsaved-changes bar

`src/components/ui/unsaved-changes-bar.tsx`

```tsx
<UnsavedChangesBar dirty={dirty} count={changed} onDiscard={reset} onSave={save} pending={saving} />
```

- It **appears only when the form is dirty** and floats at the bottom, centered on the content column (it is portalled and tracks `#main-content`), at most `max-w-3xl`. It uses `shadow-raised` (A3-F05, A3 B07).
- It shows a summary ("2 unsaved changes", or a custom summary such as "1 field, 2 variables", omitting zero parts), **Discard** (default), and **Save changes** (primary, with `loading`) (A4-F08, A5-L5).
- While visible, it adds `data-unsaved` to `#main-content`, which pads the page bottom so the last field stays reachable.
- It warns before leaving: `beforeunload`, plus a confirmation on in-app link clicks.
- There is one bar per page. Several cards on one page share a single draft and a single bar.
- Discard restores the saved values **without** marking the form dirty again (programmatic select changes are ignored).

## Field anatomy and layout

- Label, then control, then hint. The error replaces the hint (see [Form controls](../components/form-controls.md#field-anatomy)).
- **Optional fields** are labelled "(optional)". Required fields aren't marked (A2-F4).
- **Group related fields** in cards with a title and hint (General, Resources, Health checks). In long dialogs, use `.overline` group labels with a divider above ("Destination", "Security") (A4-Q61).
- **Pair fields** in two columns from `sm` (`grid gap-4 sm:grid-cols-2`). Health check: Type, Path, and Port on one row (A4-Q62).
- **Widths:** single-value settings fields cap around 560px, URL and textarea fields around 720px, and numeric fields fill their column (see [Form widths](../foundations/spacing-and-layout.md#form-widths)).
- **Units** go inside the field as a suffix. Limits go in the hint ("Up to 8 cores per replica") (A2-F2).
- **Booleans:** a checkbox in forms, a switch for live toggles (A3-C13).
- **Option sets:** `Select`, with a hint describing the chosen option (A3-C18).
- **Placeholders:** none in creation and configuration forms. Examples and rules go in the hint (A3-C17).
- **Read-only values** (slugs after creation): a read-only mono field on `sunken`, with a hint such as "Set when the project was created." The server rejects changes too (A4-Q42).
- **Defaults should be useful.** Strategy defaults to Rolling. A route's port defaults to the service's known port (health check or `PORT`), and an ⓘ next to the label explains where it came from (A2-F3, A3-F22).
- Leave out of a creation dialog anything that belongs in configuration. Create service has no health check, and Create project shows no slug field (A5-M13).

## Validation

Decided in A3-C07, A4-Q19, and A4-Q60:

1. **Submit stays enabled.** Don't use "disabled until valid".
2. On submit, run native and custom validation. **Focus the first invalid field.**
3. Show each message **under its field**, replacing the hint, in `text-danger-500`. Set `aria-invalid="true"`, which keeps the red border even while focused, and link the message with `aria-describedby`.
4. Clear a field's error as soon as its input becomes valid (`onInput`).
5. Use an `InlineNotice tone="danger"` at the top only for errors **not tied to a field**: server errors, permissions, conflicts.
6. Error copy says what to do: "Enter a valid container image reference.", "Use uppercase letters, digits, and underscores."

Reference implementation: `src/components/create-service-dialog.tsx` (`onInvalid` and `onInput` handlers).

Exceptions that keep a submit gate:
- Type-to-confirm deletion (the button is disabled until the typed slug matches).
- A pending request (`loading`).

## Dialog forms

- Dialog `size`: `md` for ordinary forms, `lg` for editors (see [Overlays](../components/overlays.md#sizes)).
- Focus the first field on open (automatic).
- The footer holds Cancel, then the primary submit.
- Keep the dialog open on failure, with the error at the top or under the field.
- A dialog that can grow (for example when route protection adds a password field) is pinned to the top, so it doesn't jump (A5-M12).
- After creating something sensitive, switch the same dialog into its result state (see [Secrets](secrets-and-credentials.md)).

## Server actions

- Mutations live in `src/lib/actions/`. They return structured errors (`src/lib/action-error.ts`) that the form maps to field errors or a notice.
- Every mutation re-checks authorization and ownership on the server and records an audit entry. Follow the existing `recordAudit` patterns.
