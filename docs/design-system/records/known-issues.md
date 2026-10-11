# Known issues and open items

These are gaps between the design system as documented and the code, plus open questions. They were found while writing this guide (Oct 4, 2026), by reading the source, measuring token contrast, and reviewing the latest UI captures.

When you fix one, delete its row and add a [changelog](../changelog.md) entry. When you find one, add it here instead of documenting the deviation as a rule.

Audit review (Oct 2026) resolves the card-title question (R3/A2), StatCell thresholds (A6), team Danger zone title/layout (C21), and Nodes wording (L11); their rows are removed below. This records the approved documentation resolution, not independent proof that the parallel implementation has passed captures. The retired info family also no longer has an active contrast issue (M2/G1).

## Dark theme

The dark theme is not fully verified (A4-Q38). Measured with the current tokens:

| Issue | Measurement | Suggested direction |
| --- | --- | --- |
| White text on dark `brand-500` (primary buttons) | about 2.2:1 (needs 4.5:1) | Use dark text on light teal in dark mode (an `on-brand` token), or a darker dark-mode `brand-500` |
| White text on dark `danger-500` (destructive buttons) | about 2.8:1 | Same approach as primary |
| Dark `ink-faint` | 5.3:1, practically equal to `ink-muted` | Make it genuinely faint (non-text only), as in light mode |
| Dark `brand-400` equals the light value | — | Review the whole dark brand ramp |

## Theming

| Issue | Details |
| --- | --- |
| Theme choice isn't re-applied on load | `appearance-settings.tsx` writes `localStorage.theme` and sets `data-theme`, but nothing reads it at startup. Explicit Light or Dark therefore only lasts until the next full page load. It needs a small blocking script in `src/app/layout.tsx` |

## Drift from documented rules

| Where | Rule | Current |
| --- | --- | --- |
| `src/app/(dashboard)/settings/layout.tsx` | H1 uses `PageHeading` (`font-bold tracking-tightest`) | Hand-written `h1` with `font-semibold tracking-tight` |
| `src/components/header-bar.tsx`, Search button | No `shadow-card` on buttons (A1 P3-06) | Has `shadow-card` |
| `service-tabs.tsx` | The focus ring has a 2px offset like `ProjectTabs` | The ring has no offset |
| `src/app/(dashboard)/error.tsx` | The landing page is "Home" (A2-C10) | Copy says "return to the overview" and "Back to overview" |
| `src/app/(dashboard)/not-found.tsx` | Page-size title (A2-H3) | `text-xl` (22px), not the 26px H1 |
| `src/components/constellation-bg.tsx` | — | Unused component. Delete it, or document it |

## Observed in the latest captures (Oct 2026)

These come from the fake-cluster gallery. Verify against real data before treating them as bugs.

| Screen | Observation |
| --- | --- |
| Status › Restart pending | The same service appears twice ("Order Worker" and `order-worker`). Next restart shows both "in 30 seconds" and "in 30s" |
| Service Overview | Keep the CPU skeleton until the second sample. The approved footer is "Across N tasks · Sampling" (singular task at 1), then "Across N tasks · Sampled …" only when a value exists (T3). Verify the transition in captures; do not replace the skeleton or show a sampled timestamp before measurement |
| Members (narrow) | The audit 1 portal review noted a page-level horizontal overflow at 390px that was left unchanged. It has not been confirmed fixed since |

## Open questions

- **Dark mode readiness**: once the contrast fixes land, should the theme control become more prominent (A4-Q38 deferred this)?
- **Server-side pagination**: history filters and pagination are client-side over all returned rows. Large histories may need server-side filtering (audit 1 implementation notes).
- **Sign-in panel**: the A4-Q65 answer was free text, and the full-page interpretation (A4-F40) was implemented without a follow-up confirmation.
- **Still undecided in Audit review (Oct 2026):** C2, C25, C27, M4, S3, S5, S7, S8, K9 (fixes); C28, S9, F2, N4, G3 (decisions). Do not infer decisions from this documentation update.
