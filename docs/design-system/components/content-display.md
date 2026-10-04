# Content display

Sources: `src/components/page-heading.tsx`, `time.tsx`, `resource-id.tsx`, `status.tsx` (`Mono`), `src/components/ui/empty-state.tsx`, `avatar.tsx`, `collapsible.tsx`, `src/components/one-time-secret.tsx`, `key-value-editor.tsx`, `variables-section.tsx`.

## PageHeading

```tsx
<PageHeading
  title="Storefront"
  status={<StatusDot status="healthy" />}
  description="Only when it adds information."
  meta={<><Mono>ghcr.io/acme/storefront:v2.4.1</Mono><MetaItem label="Ready" value="2/2" /></>}
  actions={<><Button><RotateCcw />Roll back…</Button><Button variant="primary"><Rocket />Deploy</Button></>}
/>
```

| Slot | Rendering |
| --- | --- |
| `title` | The heading at the level given by `as` (`h1` default, `h2`, `h3`). See [the heading hierarchy](../foundations/typography.md#heading-hierarchy) |
| `status` | Chips placed **right after** the heading, in the same row, outside the heading element (A4-Q21, A5-H4) |
| `description` | `mt-2 text-sm text-ink-soft`, at most `max-w-2xl`. Only where it adds information (A3-S21) |
| `meta` | `mt-3` row of facts, wrapping with `gap-x-5`. Use `MetaItem`, `Mono`, `Time`, and links |
| `actions` | Right-aligned and top-aligned with the title. Moves under the title on mobile |

`MetaItem icon? label value` renders an optional faint icon, a muted label, and a `font-medium` value.

Use `PageHeading` for every page H1 and for tab section H2s (`as="h2"`). Don't hand-roll headers. Contract: "shared controls and headings preserve disabled and type scale contracts".

## Time

```tsx
<Time value={deployment.createdAt} />                 // "1h ago"
<Time value={deployment.createdAt} mode="absolute" /> // "Oct 2, 2026, 15:36 GMT+2"
<Time value={sample.at} mode="live" />                // "12s ago", updating every second
```

- It renders a `<time dateTime>` element. Its `title` always shows the full local timestamp plus UTC ("Oct 2, 2026, 23:05 CEST · 21:05 UTC") (A3-T16).
- `relative` (the default) is for lists, tables, and activity. `absolute` is for detail-page facts (A3-T15). `live` is for metric footers ("Updated 5s ago"). Future times read "in 7 days" (A5-M3).
- It updates every minute (every second in `live` mode). The first render is server-safe (UTC absolute), so there is no hydration mismatch.
- It **inherits** the surrounding size and color. Set color at the call site (usually `text-ink-muted`) (A3-T10).
- Invalid or missing values render "—".

Use `<Time>` for **every** timestamp. Don't call `toLocaleString` or write local relative-time helpers (A1 P1-07).

## ResourceId

```tsx
<ResourceId value={allocation.id} name={allocation.name} copy />
```

- Shows the **readable name** when there is one. Opaque IDs (UUIDs, long hex) are **shortened in the middle** (`e7423a…9f12`), with the full value in `title` (A1 P0-02).
- Always mono. `copy` adds a copy `IconButton` with a 2s "Copied" state and an inline "Copy failed" error.
- Use it for node, allocation, and job identifiers in tables, headers, dialogs, and the audit log. **Never** `id.slice(0, 8)`.

## Mono

`<Mono>…</Mono>` gives `font-mono text-code text-ink-soft`. It's the default wrapper for copyable values in body text and meta rows. See [the monospace rule](../foundations/typography.md#the-monospace-rule).

## EmptyState

```tsx
<EmptyState
  icon={<Rocket className="h-4 w-4" />}
  title="No deployments match these filters"
  body="Try a different search or reset all filters."
  action={<Button variant="primary" onClick={clear}>Clear filters</Button>}
/>
```

A centered layout: a 40px `sunken` icon tile, a `text-sm font-semibold` title, a `text-sm text-ink-muted` body (`max-w-sm`), and an optional action. Use the **same large style everywhere**, including inside cards (A2-D9, A3-C09). See [Empty states](../patterns/empty-loading-and-error-states.md#empty-states) for content rules.

## Avatar

`Avatar` / `AvatarImage` / `AvatarFallback`: a 32px square (`rounded-md`). The fallback is a **neutral tile**: `bg-surface`, `border-line-strong`, `text-2xs font-semibold text-ink-soft` initials (A3-T18). Sizes are set by the caller (`h-6 w-6` in the sidebar). Avatars represent people only. Audit actors use icons instead (see [Iconography](../foundations/iconography-and-brand.md#audit-actors-and-deployment-triggers)).

## Disclosure

Use `Collapsible` with a **chevron button** (`ChevronDown` that rotates when open, `aria-expanded`) for every show-and-hide control (A2-D3, A2-M12). Don't use native `<details>` triangles.

- In-card disclosure: a link-style trigger ("Show details"), as in deployment event details.
- Section disclosure: a `CardHeader` with the title, hint, and a chevron `IconButton`. Example: Configuration › Advanced, which is collapsed by default and is part of the same draft (A4-Q30, A5-M9).
- A list where one row expands (domain DNS records) keeps **one row open at a time**, expanding into a full-width row beneath (A3-L23, A4-Q40).

## OneTimeSecret

```tsx
<OneTimeSecret label="API key" value={token} />
```

A visible `Label`, a read-only **mono** `Textarea` on `sunken` that wraps long values (`break-all`), and a `Copy` button centered beside it. Copying fires a toast and a 2s "Copied" state. It is used by API keys, webhooks (URL and token), and invitations. See [Secrets and credentials](../patterns/secrets-and-credentials.md).

## Variables

- **`VariablesSection`** is the one variables UI (A3 B15). On the **project** Environment page it is a matrix: rows are keys, and the columns are Shared plus each service. On a **service** Configuration tab it is Key · Value · Source (A4-Q35).
- Cell rules: revealable values show `••••••••` with an eye button, and re-mask on blur. A shared write-only value shows `••••••••` and a lock icon, with no "Unavailable" text and the tooltip "Write-only. Set {time}." A service row that inherits the shared value shows a muted "—" with Source "Shared". A secret binding shows a lock icon and the binding (A4-Q33, A5-M19).
- Editing: a pencil on a row opens a dialog for that one variable. "New variable" and "Paste .env" open dialogs (A3-U03).
- **`KeyValueEditor`** edits key and value rows. Keys are validated against `^[A-Z_][A-Z0-9_]*$` with no duplicates, and `parseEnvText` imports `.env` text.
