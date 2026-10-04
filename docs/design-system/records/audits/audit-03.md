# Audit 3: Decision questionnaire and UI fix list (B01–B73)

| | |
| --- | --- |
| **Date** | October 2026 (third round) |
| **Scope** | The full interface. A 139-question decision form (tokens, status words, navigation, layouts, flows, components, auth), then 7 follow-up questions, then a 73-item fix list built from the answers |
| **Output** | 146 answered decisions (prefix `A3-`). 73 findings (`B01`–`B73`) with a per-item implementation status |
| **Follow-up** | Implemented in commit `460ef29` ("Complete UI fix checklist and incorporate portal review feedback", Oct 3). It introduced the 4/6/8/12 radius scale, `.overline`, the 12.5px mono rule, and `src/lib/status.ts` |
| **Formerly** | `docs/ui-fix-checklist.md` (the status column below), merged into this record |

> Historical record. This audit set most of today's vocabulary and structure. Some answers were later refined: input focus (A4-Q17), Advanced as a tab (A4-Q30), and a few service-variable cells (A4-Q33–Q35, A5-M19). See the [decision log](../decision-log.md).

## Summary

Audit 3 was the largest round. It asked the product owner to choose between concrete options for nearly every recurring UI question, then turned the answers into a 73-item fix list. Its main outcomes:

- **Foundations:** the prototype radius scale (4/6/8/12), strong control borders, the soft focus halo, separate status green, neutral in-progress states, purple for Rolled back only, one overline style, border-only cards, local time with UTC on hover, and mono for anything copyable.
- **Vocabulary:** Failing, Succeeded, Healthy (nodes), Restart pending, Status, Home, Deployments (service tab), Danger zone, the New/Create versus Add/Attach and Delete/Remove/Revoke verb rules, and readable audit sentences.
- **Structure:** 6 project tabs with a unified Settings, allocations on their own pages, an empty-project checklist, the variables matrix, the Home order (attention, stats, deployments), and Projects as a table.
- **Flows:** a rollback picker that excludes the running release, a deploy confirmation with a diff, type-to-confirm with the slug, inline validation with enabled submit buttons, and one-time secret dialogs.

## Decisions

### T · Tokens and foundations

| ID | Question | Decision |
| --- | --- | --- |
| A3-T01 | Radius scale | Prototype scale: 4 / 6 / 8 / 12 |
| A3-T02 | Border strength for form controls | --line-strong for controls only |
| A3-T03 | Input focus style | Soft halo (prototype) |
| A3-T04 | Colour for “healthy / succeeded” | Keep the separate status green |
| A3-T05 | Colour for “in progress” | Neutral + spinner (current) |
| A3-T06 | What purple (info) means | Rolled back only |
| A3-T07 | Section label (overline) style | 11px uppercase, slight tracking, semibold |
| A3-T08 | Card elevation | Border only; shadows only on overlays |
| A3-T09 | Canvas vs card contrast | Keep current canvas |
| A3-T10 | Inline relative time size | Inherit size from the surrounding text |
| A3-T11 | When to use monospace | Anything a user might copy |
| A3-T12 | Ready count format | 2/2 ready |
| A3-T13 | Duration format | 1m 30s |
| A3-T14 | Memory units | Pick the unit automatically: 512 MB, 16 GB |
| A3-T15 | Relative vs absolute timestamps | Relative in lists, absolute on detail pages, tooltip both ways |
| A3-T16 | Timezone | Local time, UTC in the tooltip |
| A3-T17 | Project icon | Folder |
| A3-T18 | Avatar style | Neutral tile with a border |

### S · Status words, names, and copy

| ID | Question | Decision |
| --- | --- | --- |
| A3-S01 | Label for a service that isn’t running | Failing |
| A3-S02 | Label for a successful deployment | Succeeded |
| A3-S03 | Label for a working node | Healthy |
| A3-S04 | Project-level status | Count when not all OK |
| A3-S05 | Name for crash-restart backoff | “Restart pending” |
| A3-S06 | Term for a running copy of a service | Allocation |
| A3-S07 | Name for the cluster page | Status |
| A3-S08 | Name for the landing page | Home |
| A3-S09 | Name for the service history tab | Deployments |
| A3-S10 | Name for the destructive settings section | Danger zone |
| A3-S11 | Verbs for creating things | New things: New / Create. Links between things: Add / Attach |
| A3-S12 | Verbs for removing things | Delete destroys, Remove detaches, Revoke ends a credential or grant |
| A3-S13 | Naming people in confirmations | Name, email underneath |
| A3-S14 | Activity sentence format | A full sentence per action |
| A3-S15 | Showing raw action keys | Keep as a secondary mono line (current) |
| A3-S16 | Audit change display | Inline "old → new", no quotes, muted old value |
| A3-S17 | Trellis jargon | Plain labels with the Trellis term in a tooltip |
| A3-S18 | Volume path display | Keep "@/…" with a tooltip explaining it |
| A3-S19 | "Entity" column on Project › Access | “Keep Entity” |
| A3-S20 | How secrets are named in bindings | The secret’s name (DATABASE_URL) |
| A3-S21 | Page descriptions under titles | Only where they add information |

### N · Navigation and structure

| ID | Question | Decision |
| --- | --- | --- |
| A3-N01 | Sidebar "Recent projects" | Keep most-recent order |
| A3-N02 | Organization switcher location | First breadcrumb item (current) |
| A3-N03 | Theme switch | Appearance section in Settings › Account |
| A3-N04 | Global cluster health indicator | None (current) |
| A3-N05 | Where cluster connection settings live | “Keep it in settings, but add an "Edit" icon (let me know if this is inconsistent with other surfaces)” |
| A3-N06 | Settings nav "Account › Account" | “Group "Personal", item "Account"” |
| A3-N07 | Settings content width | Everything full width |
| A3-N08 | Project tabs | 6 tabs; Settings holds Integrations and Access as sub-sections |
| A3-N09 | Project tab order (if tabs stay flat) | “By how often each is used, but predefined order -- do not do it dynamically” |
| A3-N10 | Service tabs | Keep 5 |
| A3-N11 | Where a service’s environment variables are edited | Also a "Variables" section in service Configuration |
| A3-N12 | Where allocation detail opens | Own page with its own header; breadcrumb back to the service |
| A3-N13 | Allocation page order | Tabs: Logs · Details · Lifecycle |
| A3-N14 | Breadcrumb truncation | Collapse middle levels after 4 |
| A3-N15 | Deployment detail title | Image tag as the title, service linked above |
| A3-N16 | Home title | Keep "Home"; remove the duplicate sentence |
| A3-N17 | Repeated heading under project tabs | Keep the H2, drop descriptions |
| A3-N18 | Project header height | “Title, description and tabs” |
| A3-N19 | Command palette default list | Recent pages, then navigation, then actions |
| A3-N20 | Command palette with no results | "No results" only |
| A3-N21 | Clicking table rows | Whole row clickable, chevron at the end, name styled as a link |
| A3-N22 | Instance › Organizations row action | Click to switch to that organization |

### L · Page layouts

| ID | Question | Decision |
| --- | --- | --- |
| A3-L01 | Home layout | Attention list → stats → recent deployments (5) + cluster/activity |
| A3-L02 | "Needs attention" presentation | “None of the above. Do table format.” |
| A3-L03 | Home "Deployments · 14 days" chart | Thin stacked bars on a baseline |
| A3-L04 | Home "Recent deployments" length | 8 rows |
| A3-L05 | Home side cards | Keep both as they are |
| A3-L06 | Projects list format | Table rows |
| A3-L07 | Projects filter box | Only when there are more than 8 projects |
| A3-L08 | Project Overview content | Attention + health strip + recent deployments + routes |
| A3-L09 | Empty project | One setup checklist card |
| A3-L10 | Environment page structure | A single table: variables × where they apply |
| A3-L11 | Show project variable values? | Mask project and service variables both |
| A3-L12 | Editing variables | “Row-level edit and dialog” |
| A3-L13 | Status (cluster) page order | Keep current order |
| A3-L14 | Empty cluster sections | Keep a slim one-line row |
| A3-L15 | List allocations on a node page? | Add an "Allocations on this node" table |
| A3-L16 | Node actions | Keep the menu |
| A3-L17 | Node capacity chart | Allocated bar with a "used" tick |
| A3-L18 | Node page sections | Merge: details include capabilities; capacity includes live usage |
| A3-L19 | Explaining why a service is failing | Popover on the status chip |
| A3-L20 | Extra content on service Overview | Add usage only |
| A3-L21 | Service history table columns | As (a) plus a revision number |
| A3-L22 | Usage stats on the allocation page | Value / limit with a meter |
| A3-L23 | DNS record display | Expand into a full-width row under the domain |
| A3-L24 | Routes shown on a domain row | Count only, linking to the routes |
| A3-L25 | Deployment status filter | A select like the project filter |
| A3-L26 | Lifecycle history style | Vertical timeline, coloured dots, no spinners |

### F · Flows and actions

| ID | Question | Decision |
| --- | --- | --- |
| A3-F01 | Where rollback starts | Header button opens a picker of earlier successful releases |
| A3-F02 | Rollback confirm button style | Primary (brand) |
| A3-F03 | Deploy confirmation | Show what changes (image, replicas, env) |
| A3-F04 | Showing saved-but-not-deployed changes | Chip in the service header + Deploy button highlighted |
| A3-F05 | How forms save | Floating bar, centred on the content column, spacer moved to the page bottom |
| A3-F06 | Editing routes | Full edit dialog (all fields) |
| A3-F07 | Which deletions ask you to type a name | Project, organization, verified domain with routes, volume in use |
| A3-F08 | What to type to confirm | The slug, shown in the project header so it’s known |
| A3-F09 | Deleting a volume that’s still mounted | Disable, listing the services using it |
| A3-F10 | Change password submit | Its own "Update password" button in the card |
| A3-F11 | Settings › Organization › General | Merge General + Cluster connection into one "Organization" page |
| A3-F12 | Renaming a team | Rename in the page header (⋯ or button); Delete stays in a danger section |
| A3-F13 | Member detail actions | Add role change and Remove to the detail page |
| A3-F14 | Changing a member’s role | “F14 doesn't seem to allow me to pick” |
| A3-F15 | People who already have access, in the Grant access picker | Hide them |
| A3-F16 | Project › Access: who is listed | Everyone with access, with a "Source" column |
| A3-F17 | "Instance role" column on Members | Show only to instance admins |
| A3-F18 | "Instance role" field in Invite people | “Only for instance admins, but don't put it under "Advanced"” |
| A3-F19 | Closing one-time secret dialogs | No gating; a clear warning |
| A3-F20 | Declining an invitation | Add "Decline" |
| A3-F21 | Primary action on a failed deployment | Roll back to the last good release, when one exists |
| A3-F22 | Default strategy for new services | Rolling |

### C · Components and controls

| ID | Question | Decision |
| --- | --- | --- |
| A3-C01 | Row actions | "⋯" for 2+ actions; a single icon button for one action |
| A3-C02 | Single-action icon colour | Neutral; red on hover |
| A3-C03 | Section headers | Title + count + action in the card header |
| A3-C04 | Primary buttons per page | One per card |
| A3-C05 | "+" icon on create buttons | Always on create triggers; never in dialog submit buttons |
| A3-C06 | Destructive button styles | Outline to open the dialog, solid to confirm (current) |
| A3-C07 | Disabled submit buttons | Keep enabled; show what’s missing when clicked |
| A3-C08 | One-time secret display | Labelled, read-only mono field + Copy (one component) |
| A3-C09 | Empty state size | Large everywhere (current) |
| A3-C10 | Filtered-empty states | "Clear filters" as the main action |
| A3-C11 | Dialog widths | Rule: sm for confirmations and one field, md for forms, lg for editors |
| A3-C12 | Close ✕ on confirmation dialogs | Add ✕ for consistency |
| A3-C13 | Boolean fields in forms | Checkbox in forms, switch for live view toggles |
| A3-C14 | Choosing teams when inviting | Multi-select with chips (scales) |
| A3-C15 | Grant access picker | Search field; results appear while typing |
| A3-C16 | Custom expiry date picker | Preset durations + a date-only field |
| A3-C17 | Placeholders | No placeholders; helper text only |
| A3-C18 | Explaining deployment strategies | Helper text under the select for the chosen option |
| A3-C19 | Numeric field widths | Fill the grid column |
| A3-C20 | Add route preview before a prefix is typed | Muted "<prefix>.acme.test" until typed, always mono |
| A3-C21 | Loading state for stat values | Skeleton bar |
| A3-C22 | Counts on tabs | Services only, hidden when 0 |
| A3-C23 | Pagination | Range + Previous/Next (current) |
| A3-C24 | Log level colouring | Colour WARN and ERROR only |
| A3-C25 | Terminal container | Large panel that can go full-screen |
| A3-C26 | Trigger column | Icon + label, actor underneath (current) |

### A · Sign-in and public pages

| ID | Question | Decision |
| --- | --- | --- |
| A3-A01 | Login left panel | Keep the animated panel |
| A3-A02 | Auth button width | Full width on all auth cards |
| A3-A03 | Protected-route page for site visitors | Neutral page: hostname, password, small "Protected by Bower" footer |
| A3-A04 | Password requirements | Helper text under the field |

### Follow-up questions

| ID | Question | Decision |
| --- | --- | --- |
| A3-F14 | Changing a member’s role | Role as text; change it on the detail page only |
| A3-U01 | How to show "Edit" for the cluster connection on the Status page | “Let's just not link to settings at all then” |
| A3-U02 | Revealing masked variable values | Reveal one value on click; it re-masks when you leave |
| A3-U03 | What "Row-level edit and dialog" means for variables | Pencil on a row opens a dialog for that one variable; adding also uses a dialog |
| A3-U04 | Descriptions under project tab headings | S21 wins: keep only the informative descriptions, drop the rest |
| A3-U05 | Project health in the project header | Status chip next to the title |
| A3-U06 | Monospace in titles | Titles stay sans; mono applies to body text and tables only |

## Fix list (B01–B73) and implementation status

The status and evidence columns come from the checklist recorded on Oct 3, 2026. "Implemented" means the source had the requested behavior at that time. "Partial" names the remaining gap. "Departure" is an intentional constraint. "Superseded" means a later change replaced the item.

| ID | Area | Finding | Status | Implementation and evidence (Oct 3, 2026) |
| --- | --- | --- | --- | --- |
| B01 | Home | “Recent deployments” shows each service’s current health, not the deployment’s result | Implemented | `dashboard/page.tsx` uses `DeploymentsTable`, which renders `deployment.status`; preset regression: `ui-contracts.test.ts`. |
| B02 | Navigation | Team detail breadcrumb shows a mangled UUID | Implemented | `lib/breadcrumbs.ts` resolves `teamLabels` and falls back to “Team”; `breadcrumbs.test.ts`. |
| B03 | Deployments | “Roll back” is offered for the release that’s already running | Implemented | `lib/service-releases.ts` selects earlier successful retained releases; service/deployment actions consume it; `service-releases.test.ts`. |
| B04 | Services | A failing service doesn’t say why | Implemented | `service-status.tsx` exposes restart state, message, retry and actions in a keyboard popover. |
| B05 | Services | Deploy dialog promises a review it doesn’t show; saved-but-undeployed changes are invisible | Implemented | `lib/service-config-diff.ts`, `service-actions.tsx`, and `service-header.tsx`; `service-config-diff.test.ts`. |
| B06 | Allocations | Terminal text is widely spaced | Implemented | `exec-dialog.tsx` resolves the computed JetBrains family, loads it, fits, and supports full screen. |
| B07 | Forms | Unsaved-changes bar adds blank space inside cards and covers fields | Implemented | `ui/unsaved-changes-bar.tsx` portals the bar; `globals.css` pads `#main-content[data-unsaved]`. |
| B08 | Foundations | Checkboxes look like radio buttons | Implemented | `ui/checkbox.tsx`: `rounded-sm border-line-strong`; `ui-contracts.test.ts`. |
| B09 | Foundations | Adopt the prototype radius scale | Implemented | `globals.css`: 4/6/8/12px (`sm/md/lg/xl`); controls/cards use semantic radius classes; `ui-contracts.test.ts`. |
| B10 | Foundations | Form controls are hard to see; focus differs from buttons | Implemented | Input/select/textarea/checkbox use strong borders and 3px brand focus; `ui-contracts.test.ts`. |
| B11 | Forms | Invalid fields don’t look invalid while focused; save stays enabled | Implemented | Input/textarea invalid focus classes override brand state; variable form focuses `:invalid`; `ui-contracts.test.ts`. |
| B12 | Status & copy | One status vocabulary and one status component | Implemented | `lib/status.ts` is the status label/tone/progress table used by `components/status.tsx`; `ui-contracts.test.ts`. |
| B13 | Allocations | Past lifecycle states show loading spinners | Implemented | `components/timeline.tsx` renders passed events as static neutral points; allocation/deployment pages use it. |
| B14 | Deployments | Four different deployment tables | Implemented | `components/deployments-table.tsx` owns organization/project/home/history presets; `ui-contracts.test.ts`. |
| B15 | Services | Variables: two editing models, values shown in one place and masked in another | Departure | `variables-section.tsx`/`variable-matrix.ts` unify the matrix and mask service values. Shared values are backend write-only and **cannot be revealed/copied**; UI explicitly says so. `variable-matrix.test.ts` ensures inherited/shared cells leak no value. |
| B16 | Services | Secret bindings show the internal name | Implemented | Environment query/UI pass the display name while retaining the Trellis identifier as value. |
| B17 | Project pages | Volume “Delete” is enabled while the volume is mounted | Implemented | `volume-manager.tsx` reports mounts and blocks deletion while in use; detach remains in `volume-mount-editor.tsx`. |
| B18 | Status & copy | Activity sentences fall back to “updated” | Implemented | `lib/labels.ts` has action sentences and humanized unknown fallback; emitted actions covered by `labels.test.ts`. |
| B19 | Auth & public | Visitors to a protected site see Bower’s admin sign-in layout | Implemented | `route-auth/password/page.tsx` is a minimal hostname/password card with Bower footer. |
| B20 | Home | Home: duplicate summary, chips instead of actionable rows | Implemented | `dashboard/page.tsx` starts with actionable attention rows, stats, then eight deployment rows and side cards. |
| B21 | Cluster | Draining node page says nothing about the drain | Implemented | `status/[nodeId]/page.tsx` lists node allocations and merged capacity/details with allocated bars and used ticks. Trellis does not supply a drain start time; Home renders “—” with that explanation rather than inventing one. |
| B22 | Allocations | Allocation page is nested under the service header with a second H1 | Implemented | `service-shell.tsx` gives allocations their own heading/tabs/actions; breadcrumb contract is tested in `breadcrumbs.test.ts`. |
| B23 | Deployments | Failed deployment page lacks the cause and logs | Implemented | Deployment detail renders compact failure diagnostics and available log excerpt/allocation link. |
| B24 | Access & members | Project Access lists only explicit grants | Implemented | `access/access-section.tsx` composes org/team/direct sources within the single Project Settings page; `access-actions.tsx` search excludes existing access. |
| B25 | Access & members | Twelve role dropdowns on Members; read-only member page | Implemented | `members-table.tsx` links plain-role rows; member detail owns role save/removal controls. |
| B26 | Access & members | Invite dialog leads with Instance role | Implemented | `invite-tokens-section.tsx` orders org role, teams, uses, expiry/note and conditionally shows instance role. |
| B27 | Settings | Settings labels disagree; Account nested in “Account” | Implemented | `settings-nav.tsx` and `lib/breadcrumbs.ts` share Personal/Instance/Organization labels; breadcrumb test checks Organizations. |
| B28 | Foundations | Cards: border only; shadows reserved for overlays | Implemented | `ui/card.tsx` is border-only; overlay primitives retain raised/pop shadows. |
| B29 | Foundations | One section-label (overline) style | Implemented | `globals.css` defines `.overline`; sidebar/settings/table call sites use it. |
| B30 | Foundations | Relative times shrink the text around them | Implemented | `components/time.tsx` inherits surrounding size and supplies complete title text. |
| B31 | Foundations | Timestamps: local time, UTC on hover | Implemented | `lib/format.ts` formats viewer-local values with UTC tooltip; `format.test.ts`. |
| B32 | Foundations | Monospace rule: anything a user might copy | Implemented | `status.tsx` `Mono`, `resource-id.tsx`, and global `.font-mono` establish the 12.5px copyable-value rule. |
| B33 | Foundations | Number and unit formats | Implemented | `lib/format.ts` owns readiness, memory, CPU, and deployment duration formatting; `format.test.ts`. |
| B34 | Foundations | Project icon and avatars | Implemented | Sidebar/empty states use Folder; `ui/avatar.tsx` has surfaced, strongly bordered fallback. |
| B35 | Projects | Projects list as a table | Implemented | `project-search.tsx` renders clickable project rows, aggregate health/counts, conditional search. |
| B36 | Project pages | Project header and tabs | Implemented | `project-shell.tsx`/`project-tabs.tsx` provide the six primary tabs and Settings subsections. |
| B37 | Project pages | Tab headings and descriptions | Implemented | Project tabs use shared heading structure; retained descriptions explain permissions, domain verification, or storage locality. Removed redundant Account/Organization/Organizations helper lines. |
| B38 | Project pages | Project Overview content | Implemented | Project overview contains attention/health plus shared deployments and routes cards. |
| B39 | Project pages | Empty project | Implemented | Project overview renders one staged setup checklist; creating a service unlocks Deploy, and a successful deployment unlocks Add route. |
| B40 | Services | Service tabs and header | Implemented | `service-tabs.tsx` labels revisions as Deployments; `service-header.tsx` aligns actions and Overview shows usage/limits. |
| B41 | Services | New service defaults and strategy help | Implemented | Create/configuration share Rolling default, order, and selected-strategy help. |
| B42 | Deployments | Deployment detail title and summary | Implemented | Deployment page links service, uses image title/status/meta and structured summary; breadcrumb label comes from `breadcrumbs.ts`. |
| B43 | Deployments | Status filter and search | Implemented | `deployment-filters.tsx` uses selects, padded clear affordance, and clearable no-results state. |
| B44 | Allocations | Usage stats without limits; “Sampling…” as a value | Implemented | `allocation-metrics.tsx` renders usage/limit meters and loading skeletons. |
| B45 | Allocations | Log viewer | Implemented | `allocation-logs.tsx` tones WARN/ERROR while preserving controls and plain levels. |
| B46 | Cluster | Status page naming and sections | Implemented | Status page/sidebar/breadcrumb use “Status”; compact empty rows and shared chips are used. |
| B47 | Settings | Domains table | Implemented | `domain-manager.tsx` expands DNS beneath rows and summarizes linked routes by count. |
| B48 | Settings | Change password uses the floating save bar | Implemented | `change-password-form.tsx` has an in-card Update password action. |
| B49 | Settings | Theme control | Implemented | `appearance-settings.tsx` provides System/Light/Dark on Account. |
| B50 | Settings | Team page: Rename placement and danger styling | Implemented | Team page/actions put Rename with page actions and isolate Delete in a correctly toned Danger zone. |
| B51 | Settings | Instance › Organizations rows do nothing | Implemented | `organization-row-link.tsx` makes rows keyboard/click navigable with chevron. |
| B52 | Forms | Creation and removal verbs | Implemented | Revised dialogs/actions distinguish new objects, create submissions, attach, remove, revoke, and delete. |
| B53 | Forms | Primary buttons and section headers | Implemented | Project/settings cards use header action slots and one primary action per card. |
| B54 | Forms | Row actions | Implemented | `ui/row-actions.tsx` owns multi-action menus; single destructive icons are neutral until hover. |
| B55 | Forms | One-time secret dialogs | Implemented | `components/one-time-secret.tsx` is shared by API keys, invitations, and webhooks. |
| B56 | Forms | Dialog widths and close buttons | Implemented | Dialog primitives expose sm/md/lg; `AlertDialogHeader` includes a close control. |
| B57 | Forms | Delete confirmations that ask you to type | Partial / unsupported | Project deletion uses its visible project slug. **Organization deletion is not currently supported**, so no confirmation is claimed. Domain deletion requires typing its hostname (domains have no slug), and remains blocked while routes use it; remove routes first. Owners: `project-settings-form.tsx`, `domain-manager.tsx`, `actions/domains.ts`. |
| B58 | Forms | Placeholders | Implemented | Creation/configuration examples and rules moved to helper text, including domains, while search hints remain. |
| B59 | Forms | Routes: full edit and preview | Implemented | `route-actions.tsx` edits the full route and keeps the hostname preview monospace with an explicit prefix placeholder. |
| B60 | Forms | Field widths and booleans | Implemented | Configuration/route grids use full-column numeric controls; persisted booleans use checkboxes, live log controls use switches. |
| B61 | Navigation | Command palette | Implemented | `command-palette.tsx` groups recent pages, navigation, and typed actions with a literal no-results state. |
| B62 | Navigation | Tables: row click | Implemented | `clickable-table-row.tsx` and shared deployments table provide row keyboard/click, hover, link color, and chevron. |
| B63 | Auth & public | Invitation pages | Implemented | Invitation card has full-width Accept, Decline, corrected role copy, reason-specific invalid state and Sign in. |
| B64 | Status & copy | Trellis jargon | Implemented | Allocation/node/volume pages use plain labels and explanatory tooltips for retained Trellis concepts; “Allocation” and `@/` remain as requested. |
| B65 | Status & copy | Audit log rows and diffs | Implemented | `audit-log-list.tsx` uses two-line rows and arrow diffs without JSON decoration; `labels.test.ts` covers sentences. |
| B66 | Status & copy | People in confirmations | Implemented | Member/admin/access actions put display name in title and email in description. |
| B67 | Status & copy | Small copy fixes | Implemented | Count pluralization and revised Home/member/invitation/stop/register/404 copy are present at owning call sites. |
| B68 | Services | Service variables dialog alignment | Superseded | Unified `variables-section.tsx` replaces the old per-service binding editor on current pages. |
| B69 | Services | Advanced tab heading spacing | Implemented | Advanced page uses the shared page/section heading structure. |
| B70 | Home | Stat tile meters float away from their numbers | Implemented | `dashboard-stats-bar.tsx` stacks full-width meter beneath each value. |
| B71 | Deployments | Project filter menu overflows the card | Implemented | Deployment project select aligns to the end and content width follows its trigger. |
| B72 | Forms | Grant access list styling | Implemented | `access-actions.tsx` is search-as-you-type with bounded scrolling/fade and no focus ring around the list container. |
| B73 | Navigation | Org switcher menu | Implemented | `header-bar.tsx` retains the switcher and conditionally adds Manage organizations for instance admins. |

## Kept as decided

- **Canvas colour**: Keep the current canvas (T09)
- **Healthy colour**: Separate status green, not brand teal (T04)
- **In-progress colour**: Neutral + spinner (T05)
- **Sidebar recent projects**: Most-recent order (N01)
- **Org switcher**: Stays as the first breadcrumb item (N02)
- **Global cluster indicator**: None (N04)
- **Service tabs**: Keep five (N10); only History is renamed
- **Home side cards**: Cluster and Recent activity unchanged (L05)
- **Status page order**: Unchanged (L13)
- **Node actions**: Stay in the ⋯ menu (L16)
- **Empty states**: Large, centred style everywhere (C09)
- **Pagination**: Range + Previous/Next (C23)
- **Trigger column**: Icon + label, actor underneath (C26)
- **Login panel**: Keep the animated trellis (A01)
- **Raw action keys**: Keep as the mono secondary line (S15)
- **Terms**: Keep “Allocation”, “Entity”, and the @/ volume path syntax (S06, S19, S18)

## Excluded as fixture artifacts

- **Negative durations (“-345510s”) on older deployments**: seed.mjs:142 inserts older deployments without started_at, so it defaults to now and completed − started is negative. (The list helper also lacks the Math.max(0, …) clamp the detail page has, but real deployments always have a start time.)
- **Deployment started 20:05 but events stamped 21:05**: seed.mjs:135 inserts events with the default created_at (seed time).
- **Audit summary doesn’t match details; “created route Commerce Platform”; “after” above “before”**: seed.mjs:155–162 gives all five entries the same Storefront details and points every resource_id at the project.
- **Trigger “Webhook · Alex Morgan”**: seed.mjs:125 sets triggered_by_user_id on webhook deployments.
- **Succeeded, failed and rolled-back rows share image v2.4.1**: seed.mjs:84 uses one image for all three recent deployments.
- **History “—” versions; Version equals Revision**: Older seeded rows have no trellis_version; newer rows set both to 3 − j.
- **No rollback on the failed deployment**: Older seeded successes have no job_spec, so there’s no eligible target.
- **Custom invite expiry defaulting to 2030**: capture.spec.mjs:379 types that date.
- **Sidebar background ending mid-page; login panel looking different between captures**: Full-page screenshots of a sticky h-screen sidebar; the trellis animation is mid-growth.
- **Redacted values in secret dialogs**: capture.spec.mjs:570–615 replaces them before the screenshot.

## Focused automated evidence

- `src/lib/ui-contracts.test.ts`: shared status labels/tones/spinners, control radius/strong-border/invalid-focus contract, and all `DeploymentsTable` column presets.
- Existing focused suites cited above cover breadcrumbs, labels, formatting, config diffs, releases, and write-only variable matrix behavior.
- `trellis-boundaries.test.ts` checks failing-allocation log links and route target project/environment authorization, in addition to existing runtime boundary tests.
- Final automated checks: `npx tsc --noEmit`, production `npm run build`, `npm run lint` (0 errors, 1 internal-navigation warning), and `npm test` (116 TypeScript tests passed, 1 skipped; proxy/exec suites also passed).

## Browser evidence

Production preview uses the repository's disposable UI-audit database and fake Trellis fixture, not a live cluster. Inspected captures are in `.amp/in/artifacts/`.

- Home: eight history rows with deployment results, actionable attention table, stats meters, Cluster and activity cards.
- Service failure: actual replacement-backoff message/count/time, keyboard-capable popover, working link to the failing allocation.
- Allocation: one H1, four project/service/allocation crumbs, working Logs/Details/Lifecycle tabs; lifecycle DOM has zero spinners. Metrics show usage and limits.
- Terminal: connected fixture output, resolved JetBrains font, large panel and full-screen mode.
- Variables: service value reveal and blur remasking; invalid key focuses the field with `aria-invalid=true` and red border. Shared values remain write-only.
- Project: compact tabs/health strip/shared history, and one empty-project setup card.
- Settings: invitation role order and selected team chip/square checkbox; theme selection sets `data-theme=dark`; domains expand DNS into a full-width row.
- Routes: editable traffic/protection form. Deployments: unmatched search shows a Clear filters action that restores results.

Organization deletion and read-back of write-only shared values are not claimed as implemented. All changes are local; this report does not imply a commit, push, merge, or deployment.
