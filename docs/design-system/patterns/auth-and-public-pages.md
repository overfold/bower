# Auth and public pages

Bower has two audiences outside the dashboard: **Bower users** (sign-in, registration, invitations) and **visitors to a customer's protected site** (protected-route password pages). They get deliberately different treatments.

## Sign-in, registration, invitations

`AuthLayout` (`src/components/auth-layout.tsx`):

- A **full-page `brand-950` background** with the animated `GrowingTrellis`: vines climbing vertically from the bottom edge, spread across the full width, with a clear zone behind the card. This is the same treatment at every width (A4-F40). The animation runs once per visit and respects reduced motion.
- The Bower wordmark is top-left, in white. The tagline sits at the bottom center in white: "Manage deployments on Trellis." with a muted second line.
- A **centered white card**, at most 420px wide, `rounded-xl`, `shadow-pop`, padded `p-5`/`sm:p-6`, with a soft dark glow behind it.
- Card content: a title (`text-lg font-semibold tracking-tight`, the same on every auth card), one line of context, fields, then a **full-width `md` (36px) primary button** (A3-A02, A4-Q66), then a divider and a secondary link.

| Page | Title | Primary | Secondary |
| --- | --- | --- | --- |
| Sign in | "Sign in" | "Sign in" | "Don't have an account? **Create one**" (A2-G6). Under the password field: "Forgot your password? Ask an instance admin to reset it." (A4-Q67) |
| Register | "Create account" | "Create account" | "Already have an account? Sign in". Password rules as helper text under the field (A3-A04) |
| Invitation | "Join {Organization}" | "Accept invitation" (full width) | "Decline" (ghost) (A3-F20). "{Inviter} invited you as a member. Expires {date}." The signed-in account, with "Not you? Switch account" (A2-H2) |
| Invalid invitation | "Invitation unavailable", with the specific reason: expired on {date}, already used, or revoked | "Sign in" button | — (A3 B63) |

Errors appear on the field (red border, message under it), not as a banner, unless the error isn't about a field (for example "Incorrect email or password").

## Protected-route pages (site visitors)

`src/app/route-auth/password/page.tsx`. The visitor isn't a Bower user, so the page is **neutral and light** (A3-A03, A5-H5):

- A `canvas` background with a centered card. **No marketing panel, no tagline, no dark background.**
- Title: the requested **hostname**. Copy: "This site is password protected." Owner contact guidance where available (A1 P3-10).
- A password field, then a full-width "Continue". A wrong password shows the error on the field (A5-H5).
- Footer: a small "**Protected by Bower**" in `text-xs text-ink-muted`.

Bower-account protection (`bower_auth`) sends visitors through the normal sign-in instead.

## Not-found outside the dashboard

`src/app/not-found.tsx`: the Bower wordmark, "Page not found", a one-line explanation, and a "Go to Home" primary button, on `canvas`.
