# Visual verification (UI capture)

The UI capture workflow takes screenshots of every route and the main flows against a seeded database and a fake Trellis cluster. Use it to check a visual change across the whole app, in both layouts and in dark mode, and to produce the screenshots for a [UI audit](../records/README.md#audits). It complements, and doesn't replace, the checks in [Contributing](contributing.md#verify).

## Running it in CI

In GitHub, open **Actions → ui-capture → Run workflow**. Select the branch to capture. This workflow only runs manually; it does not deploy anything or require real Trellis credentials.

Download **bower-ui-audit-desktop-<run number>** or **bower-ui-audit-narrow-<run number>** from the run's artifacts. Each is self-contained: extract it and open `index.html` for a filterable gallery, with links to lossless PNGs. Each `captures.json` records that layout's expected scenarios and whether they were captured, failed, or missing. Failure screenshots and Playwright error context are uploaded separately as **bower-ui-audit-diagnostics-<run number>**. Seed metadata and redundant per-scenario result files are not included. Artifacts are retained for 14 days and uploaded even when capture fails, provided each output directory is at most **30 MB (30,000,000 bytes)**. The workflow fails and skips uploads if any exceeds that budget; the limit applies before ZIP compression.

## What is captured

- Every `src/app/**/page.tsx` route, including auth pages, redirects, project and service details, deployment diagnostics, allocation logs/metrics, and all settings pages.
- Creation/configuration dialogs, destructive confirmations (without confirming them), team/access/invitation flows, search and filter states, conditional health checks, route protection, secret bindings, and the terminal.
- API-key, webhook, and invitation success screens. Temporary credentials are revoked/deleted and redacted before capture, including webhook endpoint URLs and their curl examples. Authentication cookies and browser storage are not exported; traces are disabled.
- Representative narrow layouts, including account/settings tabs, environment editing, audit filters, service configuration, New service and Invite people dialogs, and both the top and footer of the scrollable Add route dialog. Narrow screenshots are Chromium viewport checks, not real-device captures.
- Dark overview and service configuration layouts, exercising the app's actual preferred-color-scheme styling.
- Feedback states: success toasts in light/dark, persistent danger toasts in desktop/narrow, and the non-dismissible Trellis outage banner with its actions in desktop/narrow. Toast captures assert polite/assertive live regions, focus-paused expiry, and danger persistence beyond five seconds.

The interactive inventory follows meaningful UI areas and states:

| Area | Additional states captured |
| --- | --- |
| Auth and app shell | Login errors, invalid invitations, both branded not-found boundaries, organization picker beside breadcrumbs, account popup, populated Recent projects, command palette actions/results/empty search, notifications menu (unread badge, open, read, empty, refresh error, narrow, dark) |
| Projects | Empty project and environment, full-width unified Settings with old-section redirects, creation, permissions, variable matrix and secret bindings, route protection variants, volume editing/attachment, integrations, deletion before and after entering the required project slug |
| Deployments | Healthy/failed diagnostics, deployment confirmation, exact-deployment rollback confirmation, organization and project history pagination, project filter and empty search |
| Services and allocations | Deployment-strategy select, always-visible health/isolation/API-access controls, conditional health fields, dirty configuration and advanced-settings save bars, retained revisions and active-release rollback exclusion, failing-service diagnostics, Logs/Details/Lifecycle tabs, normal/full-screen terminal, stop confirmations, log search results/empty state and follow/wrap enabled |
| Settings | Settings navigation and account cards, member filters and detail-page action menu, administrator/member removal confirmations, team table/member dialogs, invitation link/admin/limited-use/custom-expiry forms and success, collapsed/expanded domain DNS records |
| Audit log | System actor icon, expanded before/after object diff, actor filtering, responsive filter layout |

The runner uses an optimized **`npm run build` → `NODE_ENV=production npm start`** server, ephemeral PostgreSQL, and a local fake Trellis HTTP/WebSocket server. Only a connected organization is seeded. There are no “no cluster” captures. The outage-banner scenarios temporarily point that organization's connection at an unreachable loopback endpoint and restore it in `finally`. Fake workload data includes healthy, failed, and draining states, retained revisions, metrics, logs, and lifecycle events. The fake cluster rejects workload mutations rather than pretending to deploy them; the danger-toast scenarios exercise this rejection. Screenshots are 1× resolution, with desktop 1440 × 1000 and narrow 390 × 844 CSS-pixel viewports. This reduces pixel count by 75% compared with 2× captures without dropping scenario coverage.

This is a visual inventory, not a real-cluster integration test or a pixel-diff baseline. “All flows” means the explicitly maintained scenario list, not every possible input or permission combination. New page routes fail the coverage check until added. Changed labels or unavailable expected controls fail their capture tests; remaining scenarios still run and partial artifacts remain available.

Prefer settled screens and states that materially change the layout, available controls, or feedback. Do not multiply captures for token renames, equivalent select options, every viewport, or every filter combination. Transient loading animations, infrastructure-induced error boundaries, clipboard/download plumbing, and real deployment execution are outside this inventory; screenshots are not evidence that those behaviors work.

Auth-page captures wait for the trellis lattice's introductory reveal to finish. They retain normal motion and fresh-visit vine growth rather than seeding a mature background or exercising the form to establish capture readiness.

## Local run

Use a disposable local PostgreSQL database named with the suffix `_ui_audit`. **Seeding truncates that database's Bower users and organizations, cascading to their data.** The seed refuses remote hosts and database names without this suffix. Do not point it at a database you want to keep.

```bash
export DATABASE_URL=postgres://bower:bower@127.0.0.1:5432/bower_ui_audit
npm ci
npx playwright install --with-deps chromium webkit
npm run db:migrate
node scripts/ui-capture/seed.mjs
npm run build
npx playwright test --config scripts/ui-capture/playwright.config.mjs
```

Ports 3100/3101 and 8128 must be free. Playwright owns both servers and stops them after the run. The output directory defaults to `ui-audit-output/`, which is Git-ignored. Reseeding clears previous desktop/narrow captures and diagnostics (including legacy screenshots/results/galleries) to prevent stale captures from masking failures.

For externally supervised servers (such as orb services), set `UI_AUDIT_EXTERNAL_SERVERS=1`. Use `UI_AUDIT_BASE_URL` if the app is on another port, and run that app against the same disposable database used by the seed. The audit browser and app server use `Europe/Madrid`; set `TZ=Europe/Madrid` on an external app server too so server-rendered timestamps match the capture environment. Do not reseed a database backing a preview someone is using; create a separate `_ui_audit` database instead.

## Maintaining coverage

`scripts/ui-capture/capture.spec.mjs` owns the page/flow scenario manifest and assertions. `reporter.mjs` generates each layout's inventory and gallery from Playwright results, preserving failure status across worker restarts. Add an independent scenario for each meaningful new state; wait for its expected content before capturing. `seed.mjs` owns Bower database data, and `trellis.mjs` owns fake runtime responses. Update these fixtures together when a screen's data contract changes. Playwright and its Chromium/WebKit revisions are pinned through `package-lock.json`. Chromium runs the capture scenarios; the monospace URL check also launches Linux WebKit, so both engines and their system dependencies must be installed.

The seed deliberately includes more than eight projects and ten members to expose filters, more than twenty deployments to expose pagination, multiple pending domains to expose DNS disclosures, an unused volume to enable attachment, and a successful retained predecessor matching the fake runtime's version/revision to enable targeted rollback. Every seeded project has Production, including empty projects. A system audit event contains object-valued before/after details. The owner's notification read marker is 150 minutes old, so the newest deployment outcomes start unread. Opening the menu marks them read, so the notification scenarios run in a fixed order. Keep these boundary conditions when adjusting fixtures. Removed UI states (such as the old expandable team cards) should be removed from the manifest, not retained as stale screenshots.
