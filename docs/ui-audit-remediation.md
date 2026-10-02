# UI audit remediation

Implementation coverage for the 69 findings in `Bower-UI-Audit.html`.
The original audit's file line numbers refer to an earlier revision.

## P0

| Finding | Remediation |
| --- | --- |
| P0-01 | Unconditional SVG sizing in Button, including Lucide class names containing `h-`; smaller icons in small buttons. |
| P0-02 | ResourceId preserves readable names, middle-shortens opaque IDs, and exposes the full ID through a title and optional copy action. |
| P0-03 | Cards clip table backgrounds at their rounded corners. |
| P0-04 | Environment tables stack full-width; tables no longer impose a global minimum width. Narrow tables scroll locally. |
| P0-05 | Allocations breadcrumb is not a link to a nonexistent index. |
| P0-06 | Latest deployment is queried independently per service; undeployed services say Not deployed. |
| P0-07 | Dialogs focus the first field instead of the close button, whose ring is focus-visible only. |
| P0-08 | Branded root and dashboard not-found boundaries replace the default 404. |
| P0-09 | Drain and Resume scheduling are actions, with confirmation explaining allocation impact. |
| P0-10 | Cluster summary reports draining/unhealthy state, not just connectivity. |

## P1

| Finding | Remediation |
| --- | --- |
| P1-01 | Generic duplicate token aliases removed; semantic tokens are the source of truth. |
| P1-02 | Success uses a separate green palette rather than brand teal. |
| P1-03 | Shared tone normalization aligns notices, toasts, badges, and status chips. |
| P1-04 | Progress uses info; warning is reserved for states requiring attention. |
| P1-05 | Seven named type sizes replace arbitrary pixel sizes, enforced by a local ESLint rule. Panel and card title sizes agree. |
| P1-06 | Display-label maps distinguish instance/organization roles, TLS/protection, strategy, status, and heartbeat values. |
| P1-07 | Time shares relative/absolute formatting, full timestamp tooltips, and minute updates without hydration-dependent initial output. |
| P1-08 | ProjectShell keeps full project chrome on tab pages and compact headers on deeper pages. |
| P1-09 | Single-card saves are disabled until changed; configuration/advanced use sticky dirty-state save/discard bars and departure warnings. |
| P1-10 | Horizontal settings tabs restored following portal review; account sections retain their anchors. |
| P1-11 | One Invite people entry point supports email/link flows. One editable organization-role column; labelled removal menu; filters appear above ten members. |
| P1-12 | Breadcrumbs replace redundant in-page back links. |
| P1-13 | Diagnostics include images, actor/trigger, strategy, start/duration, failure notice, allocation navigation, toned events, and collapsed key/value details. Successful stored specs can be explicitly targeted for rollback. |
| P1-14 | Final destructive confirmations are solid red; project deletion requires the exact name and lists resource counts. In-use domains remain undeletable. |
| P1-15 | API key/webhook reveal states have created titles, copy feedback, saved/copy gates, and webhook URL/token/example. |
| P1-16 | Organization and project deployment histories share search, status/project/environment filters, keyboard-accessible diagnostic rows, and pagination. Single environments do not repeat a column. |
| P1-17 | Audit history resolves resource names, filters by actor/action/resource/date, paginates, and renders compact key/value details with changed before/after fields. |
| P1-18 | Sidebar/breadcrumb keyboard rings and skip-to-content link. |
| P1-19 | Overview attention strip, actual replacement-backoff data, rolled-back chart series, latest row per service, and qualified unavailable diagnostics rather than false All clear. |
| P1-20 | Project grid includes worst service status, separate last deployment result/time, services/routes counts, and Add a service for empty projects. |

## P2

| Finding | Remediation |
| --- | --- |
| P2-01 | Project section headings restored following portal review, alongside description/action toolbars. |
| P2-02 | Service table includes status, image, observed ready/desired replicas, last deployment, routes, and full-row link. Unavailable readiness is explicit. |
| P2-03 | Project deployment history aligns service/image/status columns. |
| P2-04 | Cluster connection/state/capacity summary; compact empty pending section; paired resource meters; Actions column. |
| P2-05 | Allocation log task/follow/wrap/search/copy/download controls; muted timestamps, toned lifecycle events, simpler metric cards. |
| P2-06 | Settings/project form widths are constrained. |
| P2-07 | Teams table exposes members/project access and labelled member actions. |
| P2-08 | Verification chips do not wrap; disabled delete explains route usage; DNS records are disclosed on demand. |
| P2-09 | Missing cluster connection displays Not configured and an organization-switching Configure link. |
| P2-10 | Explicit CPU/memory inputs, units, image validation, and create-without-deploy explanation. Size presets removed following portal review. |
| P2-11 | Route hostname preview; destination/security grouping; consistent help placement; req/s units. |
| P2-12 | Invitation expiry presets with custom date option and styled team checkboxes. |
| P2-13 | Masked multiline secret field, reveal/upload controls, and binding continuation. |
| P2-14 | Mount dialog adds one mount, not the entire unsaved list; attached state is based on saved mounts. |
| P2-15 | Service action errors use feedback toasts rather than shifting header actions. |
| P2-16 | Main route skeleton boundaries; loading Button API disables and exposes pending state. Existing aria-busy callers remain supported. |
| P2-17 | Consistent disabled fields/buttons; role/domain explanations through tooltips; email explanation inline. |
| P2-18 | Organization picker restored beside breadcrumbs; sidebar connection card removed following portal review. Decorative disabled teams remain removed. |
| P2-19 | Breadcrumb name resolution, truncation/title, and intermediate collapse menu. |
| P2-20 | Static environment/TLS/protection/capability/team/count/role attributes are plain text rather than status chips. |
| P2-21 | Dialog sm/md/lg size contract; terminal keeps its intentionally wider viewport. |
| P2-22 | Distinct navigation icons and labelled route/team/member actions. |
| P2-23 | Removed redundant icon margins within Button's existing gap. |
| P2-24 | Banner dismissal uses guarded sessionStorage persistence. |

## P3

| Finding | Remediation |
| --- | --- |
| P3-01 | Text uses ink-muted; ink-faint is reserved for non-text elements. |
| P3-02 | Shared text-link style; focus-visible navigation/link affordances. |
| P3-03 | Primary hover/active use token backgrounds instead of brightness filters. |
| P3-04 | Dialog backdrops use tinted ink. |
| P3-05 | Consistent card/chart radii and named dark brand surface. |
| P3-06 | Removed field shadows while retaining card/button elevation. |
| P3-07 | Tinted avatar fallbacks replace black initials blocks. |
| P3-08 | Body font for labels/actions; mono for copyable machine values. |
| P3-09 | 40% desktop brand panel, visible initial trellis, headline in panel, explicit Sign in/Create account actions. |
| P3-10 | Protected route page includes Bower mark, requested hostname, and owner contact guidance. |
| P3-11 | Correct CPU pluralization and sentence-case Audit log title. |
| P3-12 | Constrained forms and project card grid; table/dashboard widths retained. |
| P3-13 | Workspace, recent projects, then platform navigation; recents remain per-user/per-organization. |
| P3-14 | Palette includes deployment/new-project/invitation actions, recent results, and named-project fallback. |
| P3-15 | Health/isolation/API-access fields remain visible; discrete option controls use shared selects throughout the app following portal review. |

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
