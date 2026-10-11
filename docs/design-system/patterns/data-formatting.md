# Data formatting

**All formatting goes through `src/lib/format.ts` (tested in `format.test.ts`) and `src/components/time.tsx`.** Don't format in components. If a helper is missing, add it to `format.ts` with a test.

## Time

| Where | Format | How |
| --- | --- | --- |
| Lists, tables, feeds | Relative: "just now", "5m ago", "3h ago", "6d ago", "3w ago", "4mo ago", "1y ago" | `<Time value>` (A2-A8, A3-T15) |
| Future times | "in 30 seconds", "in 7 days" | `<Time value>`. The same helper handles both directions (A5-M3) |
| Detail-page facts | Absolute, local: "Oct 2, 2026, 15:36 GMT+2" | `<Time value mode="absolute">` |
| Live readings | "12s ago", updating every second | `<Time value mode="live">` |
| Tooltip (always) | Local plus UTC: "Oct 2, 2026, 23:05 CEST · 21:05 UTC" | Automatic `title` (A3-T16) |
| Date only | "Oct 2, 2026 UTC" | `formatDate()` |
| Durations | "45s", "1m 30s" (never "90s", never negative) | `formatDeploymentDuration()` (A3-T13) |

- Show the **viewer's local time**, with UTC on hover (A3-T16).
- A time column never mixes relative and absolute values (A2-M20).
- `<Time>` inherits its size. Set it to `text-ink-muted` in metadata (A3-T10).
- Relative times under about 10s read **just now** (C9), including live samples slightly ahead of the browser clock (T2). Explicit future/countdown contexts (restart, invitation expiry) retain countdown behavior; do not use sample clamping for them.
- The prefix reads naturally: "Last deploy 1h ago", "Expires in 7 days", "Sampled just now". Chart readouts use local time with UTC in `title` (T7); failed-deployment log excerpts share allocation logs' local line-timestamp formatter (C7).

## Resources

| Value | Format | Helper |
| --- | --- | --- |
| CPU | **Cores**: "0.5 cores", "1 core", "<0.01 cores", at most 2 decimals. Inputs are in cores, and the API boundary converts to millicores | `formatCpu(millicores)` (A2-A9, A2-M14, A1 P3-11) |
| Memory | **MB**, automatically switching to **GB** at 1024 MB: "512 MB", "16 GB". Inputs are in MB | `formatMemory(bytes)` (A3-T14) |
| Usage vs limit | Tile-size "0.2 cores" plus smaller muted " of 0.5 cores", with a meter | A4 |
| Percentage | "67%" (no space), rounded | `formatPercent()` (A4-Q22) |
| Allocatable capacity | "allocatable 7.5 of 8 cores" | (A5-M5) |

## Counts and ratios

| Kind | Format | Helper |
| --- | --- | --- |
| Ratio with a noun | "2/2 ready", "2/10 uses", "3/4 healthy". No spaces around the slash | `formatRatio(value, total, noun)`, `formatReadyReplicas()` (A3-T12, A4-Q22) |
| Unknown readiness | "Unavailable · 2 desired" | `formatReadyReplicas(null, 2)` |
| Count columns | A bare number: "2" | (A4-Q22) |
| Counts in prose and card hints | Pluralized: "1 deployment", "27 deployments", "1 core" | Pluralize every count. Never "1 cores" or "(s)" |
| Aggregates | "1 of 3 failing", Nodes tile "3 nodes" with detail "2 healthy · 1 drained" | L11 |

## Images and versions

| Context | Format | Helper |
| --- | --- | --- |
| Primary display | The **tag** in mono: `v2.4.1`, or the digest after `@`. A missing tag reads `latest` | `deploymentImageTag()` |
| Under the tag (every image cell and deployment Summary) | Repository in `text-xs text-ink-muted` mono: `ghcr.io/acme/storefront` | R6/C5 |
| A change | `v2.3.0 → v2.4.1`, with the old value muted | |
| Compact deployment presets | Changed tags still show `v2.3.0 → v2.4.1`, with the repository beneath; never target-only | R6 supersedes A4-Q05/A5-M8 |
| Full reference (meta, configuration) | `ghcr.io/acme/storefront:v2.4.1`, copyable | `Mono` + copy |

## Identifiers

- **Readable names first.** Show the node name or allocation name. For opaque IDs, `ResourceId` shortens them in the middle (`e7423a…9f12`) and provides a tooltip and copy (A1 P0-02).
- Never `slice(0, 8)` an ID, and never prettify a UUID into words.
- Page titles use the readable name in sans. The mono ID goes in the meta row (A2-A6).
- Volume paths keep the `@/…` syntax, with a tooltip explaining it (A3-S18).

## Masked values

- Secret or variable values: `••••••••` (8 bullets), revealed per value on click, re-masked on blur, with Copy available while revealed (A3-U02).
- Write-only values: `••••••••` plus a lock icon, and the tooltip "Write-only. Set {time}." Not clickable (A4-Q33).
- All change tables (Deploy, Rollback, deployment Changes) mask environment values with a per-row Reveal control. Write-only shared values retain a lock and cannot be revealed; image, CPU, memory, and health-check fields remain plain (T9).

## Empty and unknown values

| Case | Show |
| --- | --- |
| No value | "—" |
| Missing value in a configuration change table | "Not set", never "—" (M3) |
| Never happened | "Never" (for example "Last deploy Never") |
| Can't be read right now | "Unavailable", with the reason in context |
| Not set up | "Not configured" |

## Labels for enums

Display copy for enums comes from `src/lib/labels.ts`. Never show a raw value or apply CSS `capitalize` (A1 P1-06).

| Enum | Labels |
| --- | --- |
| Organization roles | Owner, Admin, Member |
| Instance roles | Admin, User. Shown under the "Instance role" header, so don't repeat "Instance" (A2-C17) |
| Project roles | Viewer, Deployer, Admin, Owner, Member |
| TLS | Automatic HTTPS, Custom certificate, HTTP only |
| Protection | Public, Password protected, Bower account |
| Strategies | Rolling, Recreate, Blue/green, Canary |
| Triggers | Manual, Webhook, Promotion, Rollback, Automatic rollback |
| Heartbeat | Fresh, Stale, Never |
| Registry provider | Generic, Docker Hub, GitHub Container Registry |
| Fallback | `label(value)`: sentence case, with underscores replaced by spaces |
