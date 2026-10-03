# UI fix checklist (B01–B73)

Source of scope: the attached **Bower-UI-Fix-List.html**, in its original 73-item order. This is a code/evidence checklist, not a claim that every item is complete. “Implemented” means the current source has the requested behavior; “Partial” names the remaining gap; “Departure” is an intentional constraint; “Unsupported” means the product has no corresponding operation.

| ID | Title | Status | Implementation owner / regression evidence |
|---|---|---|---|
| B01 | Recent deployments show live health | Implemented | `dashboard/page.tsx` uses `DeploymentsTable`, which renders `deployment.status`; preset regression: `ui-contracts.test.ts`. |
| B02 | Team breadcrumb mangles UUID | Implemented | `lib/breadcrumbs.ts` resolves `teamLabels` and falls back to “Team”; `breadcrumbs.test.ts`. |
| B03 | Roll back offered for active release | Implemented | `lib/service-releases.ts` selects earlier successful retained releases; service/deployment actions consume it; `service-releases.test.ts`. |
| B04 | Failing service gives no cause | Implemented | `service-status.tsx` exposes restart state, message, retry and actions in a keyboard popover. |
| B05 | Deploy review and undeployed changes | Implemented | `lib/service-config-diff.ts`, `service-actions.tsx`, and `service-header.tsx`; `service-config-diff.test.ts`. |
| B06 | Terminal text spacing | Implemented | `exec-dialog.tsx` resolves the computed JetBrains family, loads it, fits, and supports full screen. |
| B07 | Unsaved bar creates/overlaps space | Implemented | `ui/unsaved-changes-bar.tsx` portals the bar; `globals.css` pads `#main-content[data-unsaved]`. |
| B08 | Checkboxes resemble radios | Implemented | `ui/checkbox.tsx`: `rounded-sm border-line-strong`; `ui-contracts.test.ts`. |
| B09 | Prototype radius scale | Implemented | `globals.css`: 4/6/8/12px (`sm/md/lg/xl`); controls/cards use semantic radius classes; `ui-contracts.test.ts`. |
| B10 | Weak/inconsistent control focus | Implemented | Input/select/textarea/checkbox use strong borders and 3px brand focus; `ui-contracts.test.ts`. |
| B11 | Invalid focused fields look valid | Implemented | Input/textarea invalid focus classes override brand state; variable form focuses `:invalid`; `ui-contracts.test.ts`. |
| B12 | Shared status vocabulary | Implemented | `lib/status.ts` is the status label/tone/progress table used by `components/status.tsx`; `ui-contracts.test.ts`. |
| B13 | Historical lifecycle states spin | Implemented | `components/timeline.tsx` renders passed events as static neutral points; allocation/deployment pages use it. |
| B14 | Four deployment table variants | Implemented | `components/deployments-table.tsx` owns organization/project/home/history presets; `ui-contracts.test.ts`. |
| B15 | Variable models and value reveal | Departure | `variables-section.tsx`/`variable-matrix.ts` unify the matrix and mask service values. Shared values are backend write-only and **cannot be revealed/copied**; UI explicitly says so. `variable-matrix.test.ts` ensures inherited/shared cells leak no value. |
| B16 | Secret binding exposes internal name | Implemented | Environment query/UI pass the display name while retaining the Trellis identifier as value. |
| B17 | Mounted volume can be deleted | Implemented | `volume-manager.tsx` reports mounts and blocks deletion while in use; detach remains in `volume-mount-editor.tsx`. |
| B18 | Activity falls back to “updated” | Implemented | `lib/labels.ts` has action sentences and humanized unknown fallback; emitted actions covered by `labels.test.ts`. |
| B19 | Protected site uses admin sign-in | Implemented | `route-auth/password/page.tsx` is a minimal hostname/password card with Bower footer. |
| B20 | Home duplicate summary/chip issues | Implemented | `dashboard/page.tsx` starts with actionable attention rows, stats, then eight deployment rows and side cards. |
| B21 | Draining node lacks progress | Implemented | `status/[nodeId]/page.tsx` lists node allocations and merged capacity/details with allocated bars and used ticks. Trellis does not supply a drain start time; Home renders “—” with that explanation rather than inventing one. |
| B22 | Allocation nested under second header | Implemented | `service-shell.tsx` gives allocations their own heading/tabs/actions; breadcrumb contract is tested in `breadcrumbs.test.ts`. |
| B23 | Failed deployment lacks cause/logs | Implemented | Deployment detail renders compact failure diagnostics and available log excerpt/allocation link. |
| B24 | Access omits inherited users | Implemented | `access/access-section.tsx` composes org/team/direct sources within the single Project Settings page; `access-actions.tsx` search excludes existing access. |
| B25 | Member table role selects/detail read-only | Implemented | `members-table.tsx` links plain-role rows; member detail owns role save/removal controls. |
| B26 | Invite starts with instance role | Implemented | `invite-tokens-section.tsx` orders org role, teams, uses, expiry/note and conditionally shows instance role. |
| B27 | Settings naming disagrees | Implemented | `settings-nav.tsx` and `lib/breadcrumbs.ts` share Personal/Instance/Organization labels; breadcrumb test checks Organizations. |
| B28 | Card shadows flatten hierarchy | Implemented | `ui/card.tsx` is border-only; overlay primitives retain raised/pop shadows. |
| B29 | Inconsistent overlines | Implemented | `globals.css` defines `.overline`; sidebar/settings/table call sites use it. |
| B30 | Relative time changes type size | Implemented | `components/time.tsx` inherits surrounding size and supplies complete title text. |
| B31 | Local/UTC timestamps | Implemented | `lib/format.ts` formats viewer-local values with UTC tooltip; `format.test.ts`. |
| B32 | Inconsistent monospace use | Implemented | `status.tsx` `Mono`, `resource-id.tsx`, and global `.font-mono` establish the 12.5px copyable-value rule. |
| B33 | Number/unit inconsistency | Implemented | `lib/format.ts` owns readiness, memory, CPU, and deployment duration formatting; `format.test.ts`. |
| B34 | Project icons and avatars | Implemented | Sidebar/empty states use Folder; `ui/avatar.tsx` has surfaced, strongly bordered fallback. |
| B35 | Projects should be a table | Implemented | `project-search.tsx` renders clickable project rows, aggregate health/counts, conditional search. |
| B36 | Project header/tabs | Implemented | `project-shell.tsx`/`project-tabs.tsx` provide the six primary tabs and Settings subsections. |
| B37 | Repetitive tab descriptions | Implemented | Project tabs use shared heading structure; retained descriptions explain permissions, domain verification, or storage locality. Removed redundant Account/Organization/Organizations helper lines. |
| B38 | Project Overview composition | Implemented | Project overview contains attention/health plus shared deployments and routes cards. |
| B39 | Empty project overload | Implemented | Project overview renders one staged setup checklist; creating a service unlocks Deploy, and a successful deployment unlocks Add route. |
| B40 | Service tabs/header | Implemented | `service-tabs.tsx` labels revisions as Deployments; `service-header.tsx` aligns actions and Overview shows usage/limits. |
| B41 | Service strategy defaults/help | Implemented | Create/configuration share Rolling default, order, and selected-strategy help. |
| B42 | Deployment title/summary | Implemented | Deployment page links service, uses image title/status/meta and structured summary; breadcrumb label comes from `breadcrumbs.ts`. |
| B43 | Deployment filters/search | Implemented | `deployment-filters.tsx` uses selects, padded clear affordance, and clearable no-results state. |
| B44 | Allocation metrics lack limits | Implemented | `allocation-metrics.tsx` renders usage/limit meters and loading skeletons. |
| B45 | Monochrome logs | Implemented | `allocation-logs.tsx` tones WARN/ERROR while preserving controls and plain levels. |
| B46 | Status naming/sections | Implemented | Status page/sidebar/breadcrumb use “Status”; compact empty rows and shared chips are used. |
| B47 | Domains table layout | Implemented | `domain-manager.tsx` expands DNS beneath rows and summarizes linked routes by count. |
| B48 | Password uses floating save | Implemented | `change-password-form.tsx` has an in-card Update password action. |
| B49 | Missing theme control | Implemented | `appearance-settings.tsx` provides System/Light/Dark on Account. |
| B50 | Team rename in danger area | Implemented | Team page/actions put Rename with page actions and isolate Delete in a correctly toned Danger zone. |
| B51 | Organization rows inert | Implemented | `organization-row-link.tsx` makes rows keyboard/click navigable with chevron. |
| B52 | Inconsistent creation/removal verbs | Implemented | Revised dialogs/actions distinguish new objects, create submissions, attach, remove, revoke, and delete. |
| B53 | Primary actions/header placement | Implemented | Project/settings cards use header action slots and one primary action per card. |
| B54 | Row-action inconsistency | Implemented | `ui/row-actions.tsx` owns multi-action menus; single destructive icons are neutral until hover. |
| B55 | One-time secret dialogs differ | Implemented | `components/one-time-secret.tsx` is shared by API keys, invitations, and webhooks. |
| B56 | Dialog widths/close controls | Implemented | Dialog primitives expose sm/md/lg; `AlertDialogHeader` includes a close control. |
| B57 | Typed delete confirmations | Partial / unsupported | Project deletion uses its visible project slug. **Organization deletion is not currently supported**, so no confirmation is claimed. Domain deletion requires typing its hostname (domains have no slug), and remains blocked while routes use it; remove routes first. Owners: `project-settings-form.tsx`, `domain-manager.tsx`, `actions/domains.ts`. |
| B58 | Misleading placeholders | Implemented | Creation/configuration examples and rules moved to helper text, including domains, while search hints remain. |
| B59 | Route edit and preview | Implemented | `route-actions.tsx` edits the full route and keeps the hostname preview monospace with an explicit prefix placeholder. |
| B60 | Field widths and booleans | Implemented | Configuration/route grids use full-column numeric controls; persisted booleans use checkboxes, live log controls use switches. |
| B61 | Command palette content | Implemented | `command-palette.tsx` groups recent pages, navigation, and typed actions with a literal no-results state. |
| B62 | Table row affordance | Implemented | `clickable-table-row.tsx` and shared deployments table provide row keyboard/click, hover, link color, and chevron. |
| B63 | Invitation pages | Implemented | Invitation card has full-width Accept, Decline, corrected role copy, reason-specific invalid state and Sign in. |
| B64 | Trellis jargon | Implemented | Allocation/node/volume pages use plain labels and explanatory tooltips for retained Trellis concepts; “Allocation” and `@/` remain as requested. |
| B65 | Audit rows/diffs | Implemented | `audit-log-list.tsx` uses two-line rows and arrow diffs without JSON decoration; `labels.test.ts` covers sentences. |
| B66 | People in confirmations | Implemented | Member/admin/access actions put display name in title and email in description. |
| B67 | Small copy fixes | Implemented | Count pluralization and revised Home/member/invitation/stop/register/404 copy are present at owning call sites. |
| B68 | Variable binding alignment | Superseded | Unified `variables-section.tsx` replaces the old per-service binding editor on current pages. |
| B69 | Advanced heading spacing | Implemented | Advanced page uses the shared page/section heading structure. |
| B70 | Stat meter placement | Implemented | `dashboard-stats-bar.tsx` stacks full-width meter beneath each value. |
| B71 | Project filter overflow | Implemented | Deployment project select aligns to the end and content width follows its trigger. |
| B72 | Grant-access result styling | Implemented | `access-actions.tsx` is search-as-you-type with bounded scrolling/fade and no focus ring around the list container. |
| B73 | Org switcher management link | Implemented | `header-bar.tsx` retains the switcher and conditionally adds Manage organizations for instance admins. |

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
