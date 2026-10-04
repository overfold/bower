# Audit 2: Remediation review and foundations questionnaire

| | |
| --- | --- |
| **Date** | October 2026 (second round) |
| **Scope** | The remediated interface after audit 1, desktop captures |
| **Output** | 46 findings (3 critical, 11 high, 24 medium, 8 low) and a 69-question decision form (sections A–H), all answered |
| **Follow-up** | Implemented in commit `a89b993` ("Address UI remediation checklist and expand browser audit coverage", Oct 2). It added `RowActions`, `SearchInput`, `UnsavedChangesBar`, and the `no-low-contrast-focus` and `no-faint-text` lint rules |

> Historical record. IDs in this file are prefixed `A2-` in the rest of the guide (for example `A2-B1`). Answers that were free text are quoted verbatim. Several decisions here were later refined, for example the radius scale (A3-T01) and numeric field widths (A3-C19). See the [decision log](../decision-log.md) for the current rules.

## Summary

Audit 2 found that the most visible remaining problems were about **meaning**: service status showed the last deployment's result instead of live health, counts disagreed between tiles, purple meant both "Rolled back" and "in progress", and the focus ring failed WCAG 1.4.11. The questionnaire settled the audience (technical app developers, with Trellis internals hidden), the foundations (radius, focus, faint ink, card titles, the mono rule, timestamps, units), and many page structures.

## Findings

| ID | Severity | Area | Finding | Decisions |
| --- | --- | --- | --- | --- |
| C1 | Critical | Status | Service status shows the last deployment result instead of live health | A2-B1, A2-B2 |
| C2 | Critical | Status | Dashboard allocation tile and "Needs attention" disagree | A2-B7 |
| C3 | Critical | Navigation | Project Deployments tab shows an "All projects" filter | — |
| H1 | High | Accessibility | Focus ring fails WCAG 1.4.11 non-text contrast | A2-A3 |
| H2 | High | Accessibility | Node status is conveyed by colour alone | A2-B9, A2-B10 |
| H3 | High | Structure | Service header and tabs disappear while a service tab loads | — |
| H4 | High | Structure | Service header shows only the name, and service pages have no H1 | A2-C3, A2-A7 |
| H5 | High | Components | Six different row-action patterns across tables | A2-D1, A2-D2 |
| H6 | High | Forms | Three different save patterns; disabled Save looks like a different colour | A2-D6, A2-D7 |
| H7 | High | Forms | Project and service variables use two different editors | A2-F1 |
| H8 | High | Flows | Invite people offers "By email", which adds users without their consent | A2-F6 |
| H9 | High | Flows | Failed deployment page offers only "Redeploy" | A2-G7 |
| H10 | High | Status | Status words and colours overlap | A2-B3, A2-B4, A2-B5, A2-B6 |
| H11 | High | Copy | Audit log entries are ungrammatical and repeat the raw action name | A2-G1, A2-A7 |
| M1 | Medium | Dashboard | Needs attention is a full card for one row of coloured links | A2-B8 |
| M2 | Medium | Dashboard | Home layout: duplicated capacity, unbalanced columns, filler subtitle | A2-C7, A2-C8, A2-C9, A2-C10 |
| M3 | Medium | Settings | Settings mixes personal, instance and organization pages in one flat tab row | A2-C4, A2-C5 |
| M4 | Medium | Settings | Teams table puts a member list and an "Add member" button inside one cell | A2-C14, A2-D1 |
| M5 | Medium | Settings | Members: instance role says "Instance admin" under an "Instance role" header; filter label overflows | A2-C17, A2-C15, A2-C16 |
| M6 | Medium | Structure | Project Overview services list lacks the basics | A2-C13, A2-B10 |
| M7 | Medium | States | Empty states are inconsistent and miss the next step | A2-D9 |
| M8 | Medium | Navigation | Breadcrumbs repeat the tab and change shape between tabs | A2-E1, A2-E2, A2-E5 |
| M9 | Medium | Navigation | Recent projects appears and disappears in the sidebar | A2-E3 |
| M10 | Medium | Navigation | "Cluster" names two different places | A2-C6 |
| M11 | Medium | Copy | Trellis internals exposed in Cluster and History copy | A2-A1, A2-G2, A2-G3, A2-G4 |
| M12 | Medium | Components | Disclosure, pagination and log controls use one-off styles | A2-D3, A2-D4, A2-D5 |
| M13 | Medium | Forms | Numeric fields are full-width with units in labels | A2-F2 |
| M14 | Medium | Tokens | CPU and memory units differ between screens | A2-A9 |
| M15 | Medium | Forms | Add route dialog: wrong default port, misleading preview and layout gaps | A2-F3, A2-F4 |
| M16 | Medium | Forms | Required and optional fields are not marked | A2-F4 |
| M17 | Medium | Flows | Delete-project dialog repeats itself; confirmation uses the display name | A2-F7 |
| M18 | Medium | Tokens | Radius, ink-faint and card titles drift from the system | A2-A2, A2-A4, A2-A5 |
| M19 | Medium | Tokens | Monospace used for headings and display names | A2-A6, A2-A7 |
| M20 | Medium | Tokens | Table timestamps switch format partway down a column | A2-A8 |
| M21 | Medium | Cluster | Node page shows allocation as bars but usage as plain numbers | A2-C12, A2-C11 |
| M22 | Medium | States | Deployment rows are clickable without looking clickable | — |
| M23 | Medium | States | Disabled controls don't say why | — |
| M24 | Medium | Auth | Sign-in, invitation and protected-route pages use three different layouts | A2-H1, A2-H2 |
| L1 | Low | Copy | "Register" link wording on login | A2-G6 |
| L2 | Low | States | Not-found page title is smaller than body text | A2-H3 |
| L3 | Low | Components | Tab counts are barely visible | A2-D8 |
| L4 | Low | Components | Duplicate primitives: Card/Panel, Badge variants, Button danger/destructive, search inputs | — |
| L5 | Low | Components | Mounts table has no headers; Attach volume is a secondary button | A2-D1 |
| L6 | Low | Components | API keys table is inset inside its card | — |
| L7 | Low | Settings | Domains lists project · environment once per route, without hostnames | — |
| L8 | Low | Tokens | Small text shows uneven letter spacing | — |

## Decisions

The questionnaire asked one question per decision, with mock-ups. The decision column gives the chosen option, or the free-text answer in quotes.

### A · Foundations

| ID | Question | Decision |
| --- | --- | --- |
| A2-A1 | Who is the primary audience, and how much Trellis vocabulary can the UI assume? | “Bower is for app developers and platform engineers, but that doesn't mean everything needs to be dumbed down or removed. Internal Trellis concepts shouldn't be exposed but for example cluster, note detail, managed ingress are pretty basic concepts which don't require technical experience. You might want to consider dumbing down "replacement backoff" and "retained Trellis versions" though.” |
| A2-A2 | Corner radius scale | 6 / 8 / 12 (prototype) |
| A2-A3 | Focus ring | brand-500, 2px, 2px offset |
| A2-A4 | What should ink-faint be? | Truly faint, decorative only |
| A2-A5 | Card and panel title size | 14px semibold |
| A2-A6 | Page titles for machine IDs (allocation and node pages) | Readable title + mono ID as metadata |
| A2-A7 | Where should the monospace font be used? | Only for values people copy |
| A2-A8 | Timestamps in tables | Always relative, exact time on hover |
| A2-A9 | CPU and memory units | “Cores and MB” |
| A2-A10 | Content width on list and settings pages | Full width (current) |

### B · Status and colour meaning

| ID | Question | Decision |
| --- | --- | --- |
| A2-B1 | What does a service's status mean? | Live health from running instances |
| A2-B2 | A service that is running fine, but whose newest deployment failed | Live status + "last deploy failed" marker |
| A2-B3 | Name for a successful deployment | Succeeded |
| A2-B4 | Separating "in progress" from "rolled back" | In progress = neutral chip with spinner |
| A2-B5 | Static or always-positive attributes shown as green chips | Keep chips, merge duplicates |
| A2-B6 | Allocation phase + health | One chip: health when running, otherwise phase |
| A2-B7 | Dashboard "Allocation health" tile | Count failed allocations of the current version |
| A2-B8 | Dashboard "Needs attention" | Compact strip, hidden when empty |
| A2-B9 | Node status in tables | Status column with a chip |
| A2-B10 | Where the status column sits in tables | Directly after the name |

### C · Page structure

| ID | Question | Decision |
| --- | --- | --- |
| A2-C1 | The heading stack on project tabs | “Keep as is for now” |
| A2-C2 | Section heading placement relative to cards | “Keep as is for now” |
| A2-C3 | What the service header shows | Status, image, replicas and public URL |
| A2-C4 | Settings organisation | Grouped side navigation — “Account 1st, Instance 2nd and Organization 3rd” |
| A2-C5 | Settings page title | "Settings" H1 above the nav, section as H2 |
| A2-C6 | Settings › Cluster tab name | Keep "Cluster" — “Misclick on C: I think "Status" is best” |
| A2-C7 | Dashboard: CPU and memory shown twice | Remove from the Cluster card |
| A2-C8 | Dashboard column balance | Show more deployment rows (8–10) |
| A2-C9 | Dashboard subtitle ("2 projects and 3 services.") | A one-line health summary |
| A2-C10 | Two pages both called "Overview" | Rename the dashboard to "Home" |
| A2-C11 | Cluster page: too many small cards | Keep separate cards |
| A2-C12 | Node page: allocated vs used | “One bar showing both used and allocated in diff colors, hover for exact pct” |
| A2-C13 | Project Overview: Services list | Status, ready count, image tag, last deploy |
| A2-C14 | Teams layout | Team list + team detail page |
| A2-C15 | Members: where "Invite people" lives | Keep in the Invitations card |
| A2-C16 | Changing a member's organisation role | Keep bordered selects |
| A2-C17 | Instance-admin role on the organisation Members page | “Keep on Members under "INSTANCE ROLE". Don't repeat "Instance admin" in the role again -- just "Admin"” |
| A2-C18 | Domains: DNS instructions banner | Keep always visible |

### D · Components and patterns

| ID | Question | Decision |
| --- | --- | --- |
| A2-D1 | Row actions in tables | ⋯ menu on every row |
| A2-D2 | Colour of destructive row actions | Neutral in rows; red only in menus and confirmations |
| A2-D3 | Disclosure ("show more") control | Chevron button everywhere |
| A2-D4 | Pagination | Small buttons with chevrons + "1–20 of 27" |
| A2-D5 | Log toolbar toggles | Switches with labels |
| A2-D6 | Saving on settings and config forms | Sticky unsaved-changes bar everywhere |
| A2-D7 | Save button wording | "Save changes" everywhere (password: "Update password") |
| A2-D8 | Count on tabs | Pill; tinted when the tab is active (prototype) |
| A2-D9 | Empty states inside cards | Full icon empty state in every card |

### E · Navigation

| ID | Question | Decision |
| --- | --- | --- |
| A2-E1 | Breadcrumb trailing item on tabbed pages | End at the entity; the tab bar shows the tab |
| A2-E2 | Breadcrumb collapsing | Always collapse middle crumbs past 4 levels |
| A2-E3 | Sidebar "Recent projects" | Always show the group (up to 5); hide only with no projects |
| A2-E4 | Organisation switcher contents | Keep list only |
| A2-E5 | Deployment detail: page title and last crumb | Name it by image and time |

### F · Forms and flows

| ID | Question | Decision |
| --- | --- | --- |
| A2-F1 | Editing environment variables | Editable key/value table for both |
| A2-F2 | Numeric fields (replicas, CPU, memory, port) | Fixed narrow width + unit suffix + min/max hint |
| A2-F3 | Add route: default port | Use the service's known port (health-check / PORT) — “Use the service's known port, but hide "From Checkout API's health check" a bit more” |
| A2-F4 | Marking required and optional fields | Label optional fields "(optional)" |
| A2-F5 | Account avatar | Keep URL field — “Let's keep the URL field for now, as I don't want to bother with uploading files” |
| A2-F6 | Invite people: the two options | “Only use invite links. It makes no sense to add by email, it's a separate flow, no user consent and etc” |
| A2-F7 | Delete-project confirmation | Type the project slug; one summary, no repetition |

### G · Copy

| ID | Question | Decision |
| --- | --- | --- |
| A2-G1 | Audit log entry format | Readable sentence; raw action name as small metadata |
| A2-G2 | What to call "Replacement backoff" | Restart cooldown |
| A2-G3 | "Retained Trellis versions" on service History | Fold into deployment history as a "can roll back" marker |
| A2-G4 | Advanced › Workload API access help text | Plain effect + a warning |
| A2-G5 | Access table first column header ("Entity") | “I like Entity” |
| A2-G6 | Login link to sign up | "Create an account" |
| A2-G7 | Deployment failure: primary recovery action | “Add Rollback as primary and keep Redeploy as secondary and etc” |

### H · Sign-in, invitations and errors

| ID | Question | Decision |
| --- | --- | --- |
| A2-H1 | One layout for auth pages | Split brand panel for all three |
| A2-H2 | Invitation page content | Org name, inviter, role and expiry |
| A2-H3 | Not-found page emphasis | Page-size title + path + actions |

## Excluded as fixture artifacts

These looked wrong in the captures, but the cause was the seed data or the fake Trellis server, not the UI.

- **Negative durations (−345510s)** (Deployments, Project › Deployments): The seed inserts older deployments with past created_at/completed_at but no started_at, which defaults to now().
- **Retained versions out of order (v3 oldest)** (Service › History): trellis.mjs /versions sets created_at = now − version hours.
- **Deployment events hours after the deployment** (Deployment detail): Seed events use the default created_at = now().
- **Audit details don't match the action** (Audit log): The seed writes the same details (Storefront v2.3.0 → v2.4.1) and the project ID for every action.
- **Webhook deploys credited to Alex Morgan; "Manual · System"** (Deployments): The seed sets triggered_by_user_id on webhook rows and no user on history rows.
- **Lifecycle events newer than allocation creation** (Allocation detail): trellis.mjs generates events relative to request time.
- **All log lines share one timestamp** (Allocation logs): trellis.mjs stamps every line with now().
- **"target audit-conf", "Connected to seeded audit container", "AM" avatars** (Cluster, Terminal, Members): Fixture strings and seeded user names.
- **Sparse 14-day deployment chart** (Home): The seed only covers about 7 days.
- **Service Overview and Advanced captured as skeletons** (Service tabs): Capture timing. The underlying layout problem is real and is tracked as H3.
