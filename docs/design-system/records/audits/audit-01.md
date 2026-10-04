# Audit 1: Bower UI audit (desktop, light)

| | |
| --- | --- |
| **Date** | October 2026 (first round) |
| **Scope** | 112 desktop captures (connected and public screens), cross-checked against `globals.css`, shared components, and page code |
| **Output** | 69 findings: P0 (broken or misleading) ×10, P1 (high impact on consistency or task success) ×20, P2 (medium) ×24, P3 (polish) ×15 |
| **Follow-up** | Remediated with a **portal review** pass. Implemented in commit `eff167a` ("Address UI audit and incorporate portal review feedback", Oct 2), which also added the first lint rule (`named-type-scale`) |
| **Formerly** | `docs/ui-audit-remediation.md`, which is merged into this record |

> Historical record. Line numbers and file paths in the original audit referred to an earlier revision. Where later audits changed a decision, the [decision log](../decision-log.md) records the current rule.

## Summary

The first audit found that Bower was mostly built from the prototype's tokens and component shapes, but with app-wide bugs in shared components (24px button icons, IDs cut to 8 characters, tables painting over card corners), two parallel sets of token names, brand teal doubling as "success", ad-hoc type sizes, and screens that hid what needed attention.

It set the order of work, which shaped everything after it:

1. Fix what is broken (P0).
2. Tokens and labels (P1 consistency).
3. Structure and navigation.
4. Flows and polish (P2–P3).

## Design system: keep or adopt

This was the audit's own settlement between Bower and the [prototype](../prototype-reference.md):

| Area | Decision | Why |
| --- | --- | --- |
| Primary teal (`hsl(172 77% 24%)`) | Keep Bower | Practically the prototype's `#0E6E62`. About 6.5:1 on white, with white text passing AA |
| `ink-muted` / `ink-faint` | Keep Bower values, merge or repurpose | Bower's 40% and 42% lightness pass AA for text. The prototype's faint `#9DABAE` (about 2.3:1) fails. Keep a lighter faint only for non-text |
| Token names | Adopt the prototype's | Use only canvas, surface, sunken, line, `ink-*`, `brand-*`, `warn-*`, `danger-*`, `info-*`. Drop the generic aliases |
| Primary hover | Adopt the prototype's | `hover:bg-brand-600` instead of `hover:brightness-90` |
| Dialog overlay | Adopt the prototype's | `bg-ink/25` instead of `bg-black/30` |
| Dialog primitives | Keep Bower | Radix dialogs trap and restore focus. Borrow only the prototype's scrolling body (`max-h-[62vh]`) |
| Segmented control | Adopt the prototype's (**later reversed**) | Proposed for 2–4 options. The portal review replaced segmented controls with selects |
| Sidebar structure | Adopt the pattern | Grouped navigation. (The connection footer was later dropped: A3-N04) |
| Invalid inputs, toasts, inline notices | Keep Bower | The prototype has no equivalents |
| Status tones | Keep Bower, fix the meanings | In progress must not use warn |

## Findings and remediation

| ID | Area | Finding | Remediation |
| --- | --- | --- | --- |
| P0-01 | Components | Some button icons render at 24px instead of 16px | Unconditional SVG sizing in Button, including Lucide class names containing `h-`; smaller icons in small buttons. |
| P0-02 | Layout | IDs are cut to 8 characters, so nodes and allocations look identical | ResourceId preserves readable names, middle-shortens opaque IDs, and exposes the full ID through a title and optional copy action. |
| P0-03 | Consistency | Tables paint over the card's rounded bottom corners | Cards clip table backgrounds at their rounded corners. |
| P0-04 | Layout | Project Environment tables hide the value and action columns | Environment tables stack full-width; tables no longer impose a global minimum width. Narrow tables scroll locally. |
| P0-05 | Navigation | The "Allocations" breadcrumb links to a page that doesn't exist | Allocations breadcrumb is not a link to a nonexistent index. |
| P0-06 | Layout | Project overview shows a service with no status | Latest deployment is queried independently per service; undeployed services say Not deployed. |
| P0-07 | States | Dialogs open with a focus ring on the close button | Dialogs focus the first field instead of the close button, whose ring is focus-visible only. |
| P0-08 | States | The 404 page is Next.js's unstyled default | Branded root and dashboard not-found boundaries replace the default 404. |
| P0-09 | Components | The Drain button shows the node's state instead of an action | Drain and Resume scheduling are actions, with confirmation explaining allocation impact. |
| P0-10 | Consistency | Dashboard cluster chip is green while a node is draining | Cluster summary reports draining/unhealthy state, not just connectivity. |
| P1-01 | Consistency | Two sets of token names for the same values | Generic duplicate token aliases removed; semantic tokens are the source of truth. |
| P1-02 | Consistency | "Success" uses the brand colour, so status and selection look the same | Success uses a separate green palette rather than brand teal. |
| P1-03 | Consistency | "Info" means violet in one component and grey in another | Shared tone normalization aligns notices, toasts, badges, and status chips. |
| P1-04 | Consistency | In-progress statuses use the warning colour | Progress uses info; warning is reserved for states requiring attention. |
| P1-05 | Consistency | Type sizes are set ad hoc (11 pixel values) | Seven named type sizes replace arbitrary pixel sizes, enforced by a local ESLint rule. Panel and card title sizes agree. |
| P1-06 | Consistency | Status, role and enum labels are raw values or inconsistent | Display-label maps distinguish instance/organization roles, TLS/protection, strategy, status, and heartbeat values. |
| P1-07 | Consistency | Dates and times are inconsistent and sometimes missing the time | Time shares relative/absolute formatting, full timestamp tooltips, and minute updates without hydration-dependent initial output. |
| P1-08 | Navigation | Service, allocation and deployment pages are nested inside the full project header | ProjectShell keeps full project chrome on tab pages and compact headers on deeper pages. |
| P1-09 | Components | Three different save patterns | Single-card saves are disabled until changed; configuration/advanced use sticky dirty-state save/discard bars and departure warnings. |
| P1-10 | Organization | Settings tabs mix personal, organization and instance settings | Horizontal settings tabs restored following portal review; account sections retain their anchors. |
| P1-11 | Flows | Members page: two ways to add people, and duplicate role columns | One Invite people entry point supports email/link flows. One editable organization-role column; labelled removal menu; filters appear above ten members. |
| P1-12 | Components | Four different back-link patterns | Breadcrumbs replace redundant in-page back links. |
| P1-13 | Layout | Deployment diagnostics has no summary, and failures look like successes | Diagnostics include images, actor/trigger, strategy, start/duration, failure notice, allocation navigation, toned events, and collapsed key/value details. Successful stored specs can be explicitly targeted for rollback. |
| P1-14 | Components | Destructive confirmations are visually weak, and project deletion has no extra safeguard | Final destructive confirmations are solid red; project deletion requires the exact name and lists resource counts. In-use domains remain undeletable. |
| P1-15 | Flows | Secret-reveal dialogs: wrong title, no copy feedback, webhook URL missing | API key/webhook reveal states have created titles, copy feedback, saved/copy gates, and webhook URL/token/example. |
| P1-16 | Layout | The Deployments list can't be used for triage | Organization and project deployment histories share search, status/project/environment filters, keyboard-accessible diagnostic rows, and pagination. Single environments do not repeat a column. |
| P1-17 | Layout | Audit log entries are hard to read and can't be filtered | Audit history resolves resource names, filters by actor/action/resource/date, paginates, and renders compact key/value details with changed before/after fields. |
| P1-18 | States | Sidebar and breadcrumb links have no keyboard focus style | Sidebar/breadcrumb keyboard rings and skip-to-content link. |
| P1-19 | Layout | The Overview dashboard doesn't surface what needs attention | Overview attention strip, actual replacement-backoff data, rolled-back chart series, latest row per service, and qualified unavailable diagnostics rather than false All clear. |
| P1-20 | Layout | Project cards show no health or deploy status | Project grid includes worst service status, separate last deployment result/time, services/routes counts, and Add a service for empty projects. |
| P2-01 | Clutter | Each project tab repeats its own name as a section heading | Project section headings restored following portal review, alongside description/action toolbars. |
| P2-02 | Layout | The services list shows only names and created dates | Service table includes status, image, observed ready/desired replicas, last deployment, routes, and full-row link. Unavailable readiness is explicit. |
| P2-03 | Layout | Project overview: deployment history rows don't line up | Project deployment history aligns service/image/status columns. |
| P2-04 | Layout | Cluster page: inconsistent status display and very tall node rows | Cluster connection/state/capacity summary; compact empty pending section; paired resource meters; Actions column. |
| P2-05 | Layout | Allocation detail: thin logs and a single-colour timeline | Allocation log task/follow/wrap/search/copy/download controls; muted timestamps, toned lifecycle events, simpler metric cards. |
| P2-06 | Layout | Settings form fields stretch to about 1,580px | Settings/project form widths are constrained. |
| P2-07 | Layout | Teams page: one collapsible row on an empty page | Teams table exposes members/project access and labelled member actions. |
| P2-08 | States | Domains: chip wraps, and delete is disabled without a reason | Verification chips do not wrap; disabled delete explains route usage; DNS records are disclosed on demand. |
| P2-09 | States | Instance page: blank cell for an organization with no cluster | Missing cluster connection displays Not configured and an organization-switching Configure link. |
| P2-10 | Flows | Create service: no guidance on units, and the outcome isn't explained | Explicit CPU/memory inputs, units, image validation, and create-without-deploy explanation. Size presets removed following portal review. |
| P2-11 | Flows | Add route: hostname preview is hard to see and helper text moves | Route hostname preview; destination/security grouping; consistent help placement; req/s units. |
| P2-12 | Components | Create invitation uses unstyled native date and checkbox controls | Invitation expiry presets with custom date option and styled team checkboxes. |
| P2-13 | Flows | The secret value field can't hold multiline secrets | Masked multiline secret field, reveal/upload controls, and binding continuation. |
| P2-14 | Flows | Volume mounts dialog: message contradicts the list, and mounts can only be edited in the dialog | Mount dialog adds one mount, not the entire unsaved list; attached state is based on saved mounts. |
| P2-15 | States | Service action errors push the header buttons around | Service action errors use feedback toasts rather than shifting header actions. |
| P2-16 | States | Loading feedback is inconsistent and pages have no skeletons | Main route skeleton boundaries; loading Button API disables and exposes pending state. Existing aria-busy callers remain supported. |
| P2-17 | States | Disabled controls don't say why, and use two different styles | Consistent disabled fields/buttons; role/domain explanations through tooltips; email explanation inline. |
| P2-18 | Navigation | Organization switcher sits in the breadcrumb, and its team items look disabled | Organization picker restored beside breadcrumbs; sidebar connection card removed following portal review. Decorative disabled teams remain removed. |
| P2-19 | Navigation | Long breadcrumbs, with generic labels | Breadcrumb name resolution, truncation/title, and intermediate collapse menu. |
| P2-20 | Clutter | Chips are used for everything, so status chips stand out less | Static environment/TLS/protection/capability/team/count/role attributes are plain text rather than status chips. |
| P2-21 | Components | Dialog widths vary without a rule | Dialog sm/md/lg size contract; terminal keeps its intentionally wider viewport. |
| P2-22 | Consistency | Icons have inconsistent meanings and row actions use mixed styles | Distinct navigation icons and labelled route/team/member actions. |
| P2-23 | Consistency | Extra space between button icons and labels | Removed redundant icon margins within Button's existing gap. |
| P2-24 | States | Dismissed page banners come back on every page | Banner dismissal uses guarded sessionStorage persistence. |
| P3-01 | Consistency | ink-faint and ink-muted are nearly the same colour | Text uses ink-muted; ink-faint is reserved for non-text elements. |
| P3-02 | Consistency | Two link colours | Shared text-link style; focus-visible navigation/link affordances. |
| P3-03 | Consistency | Primary hover uses a brightness filter | Primary hover/active use token backgrounds instead of brightness filters. |
| P3-04 | Consistency | Dialog backdrops are pure black | Dialog backdrops use tinted ink. |
| P3-05 | Consistency | Radius and colour one-offs | Consistent card/chart radii and named dark brand surface. |
| P3-06 | Consistency | Inputs carry a card shadow | Removed field shadows while retaining card/button elevation. |
| P3-07 | Aesthetics | Avatars are heavy black squares | Tinted avatar fallbacks replace black initials blocks. |
| P3-08 | Aesthetics | Monospace is overused | Body font for labels/actions; mono for copyable machine values. |
| P3-09 | Aesthetics | Login: large, almost empty brand panel | 40% desktop brand panel, visible initial trellis, headline in panel, explicit Sign in/Create account actions. |
| P3-10 | Aesthetics | Protected-route page has no branding and doesn't show the hostname | Protected route page includes Bower mark, requested hostname, and owner contact guidance. |
| P3-11 | Consistency | "1 cores" plural, and other copy slips | Correct CPU pluralization and sentence-case Audit log title. |
| P3-12 | Aesthetics | Pages with little content fill the whole content column | Constrained forms and project card grid; table/dashboard widths retained. |
| P3-13 | Navigation | The sidebar has no structure and no connection status | Workspace, recent projects, then platform navigation; recents remain per-user/per-organization. |
| P3-14 | Flows | Command palette lists only places, no actions | Palette includes deployment/new-project/invitation actions, recent results, and named-project fallback. |
| P3-15 | Disclosure | Advanced service options are always expanded | Health/isolation/API-access fields remain visible; discrete option controls use shared selects throughout the app following portal review. |

## Intentional implementation choices

- Compact layouts reuse the existing routes via ProjectShell instead of moving
  files into new route groups. Secret reveal flows reuse existing dialog primitives
  instead of introducing another wrapper component.
- Roll back to this appears only for a healthy deployment with a stored JobSpec.
  The server also checks service, environment, successful status, and permissions.
  It plans and applies that exact spec, not the latest deployment's predecessor.
- If diagnostics contain no allocation ID, failures link to the service's
  allocations rather than inventing a log URL.
- Existing organization/domain deletion policy is unchanged; no new destructive
  endpoint was introduced. Domains with bound routes cannot be deleted.
- History filters/pagination operate on all returned organization/project history,
  rather than silently limiting results to the newest 50/100 records. Pagination
  is client-side; large-history deployments may warrant server-side filtering.
- Account sections retain anchors in the existing account page. Instance-admin
  management remains in the members table, where its role controls already live.

## Portal review revisions

- Restored the breadcrumb organization picker and horizontal settings tabs.
- Removed the redundant system badge from audit events; source icons remain.
- Matched all three account cards to the same constrained width.
- Restored headings for every project tab.
- Replaced segmented option controls with selects, including route protection;
  removed service size presets and restored explicit resource defaults.
- Kept health checks, isolation, and workload API access visible without disclosure.
- Standardized relative/absolute time text to muted 12px metadata.
- Placed recent projects between workspace and platform navigation and raised
  the profile popup to clear the sidebar separator.
- Verified service Restart calls Trellis's job-level restart: active allocations
  are drained and replaced without changing the job specification. No operation
  was invoked against the connected cluster during this investigation.
- Retested select changes and Discard for strategy, health checks, and isolation.
  Ignored the shared select's programmatic native change events so resetting
  its value does not mark the form dirty again.
- Verified all nine project-tab headings, equal account-card widths, 12px times,
  source icons without system badges, route protection form values, and profile
  popup clearance. Fixtures and temporary browser credentials were removed.
- Narrow-screen settings tabs and member tables scroll locally. A separate
  page-level horizontal overflow remains on Members even with the settings
  navigation removed; this was not changed as part of the review revisions.

## Verification

- TypeScript, ESLint, full Node tests, and git whitespace checks.
- Regression coverage for SVG sizing/loading, resource IDs, independent latest
  service selection, project health vs last deployment, audit before/after-only
  diffs, and targeted rollback ownership/permission/exact-spec selection.
- Disposable local database/mock Trellis fixtures exercised deployment pagination
  (20 then 6 of 26), failed-only filtering (2 rows), Enter-key diagnostics, dirty
  segmented changes/discard, exact-name deletion gating without deleting, and
  logs wrap/search controls.
- Inspected rendered desktop/mobile environment, services, dialogs, compact
  allocation/configuration/diagnostics, Overview, authentication, and not-found
  states. Screenshots illustrate mocked local data, not a production deployment.
