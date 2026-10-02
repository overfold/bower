# UI screenshot audit

In GitHub, open **Actions → ui-audit → Run workflow**. Select the branch to capture. This workflow only runs manually; it does not deploy anything or require real Trellis credentials.

Download **bower-ui-audit-<run number>** from the run's artifacts. Extract it and open `index.html` for a filterable gallery. The gallery works directly from disk, with links to full-resolution PNGs. `captures.json` records each expected scenario and whether it was captured, failed, or missing. Failure screenshots and Playwright error context are under `diagnostics/`. Artifacts are retained for 14 days and uploaded even when capture fails.

## What is captured

- Every `src/app/**/page.tsx` route, including auth pages, redirects, project and service details, deployment diagnostics, allocation logs/metrics, and all settings pages.
- Creation/configuration dialogs, destructive confirmations (without confirming them), team/access/invitation flows, search and filter states, conditional health checks, route protection, secret bindings, and the terminal.
- API-key, webhook, and invitation success screens. Temporary credentials are revoked/deleted and redacted before capture. Authentication cookies and browser storage are not exported; traces are disabled.
- Representative narrow layouts, including both the top and footer of the scrollable Add route dialog. Narrow screenshots are Chromium viewport checks, not real-device captures.

The runner uses an optimized **`npm run build` → `NODE_ENV=production npm start`** server, ephemeral PostgreSQL, and a local fake Trellis HTTP/WebSocket server. Only a connected organization is seeded. There are no “no cluster” captures. Fake workload data includes healthy, failed, and draining states, retained revisions, metrics, logs, and lifecycle events. The fake cluster rejects workload mutations rather than pretending to deploy them. Screenshots are 2× resolution, with desktop 1440 × 1000 and narrow 390 × 844 CSS-pixel viewports.

This is a visual inventory, not a real-cluster integration test or a pixel-diff baseline. “All flows” means the explicitly maintained scenario list, not every possible input or permission combination. New page routes fail the coverage check until added. Changed labels or unavailable expected controls fail their capture tests; remaining scenarios still run and partial artifacts remain available.

## Local run

Use a disposable local PostgreSQL database named with the suffix `_ui_audit`. **Seeding truncates that database's Bower users and organizations, cascading to their data.** The seed refuses remote hosts and database names without this suffix. Do not point it at a database you want to keep.

```bash
export DATABASE_URL=postgres://bower:bower@127.0.0.1:5432/bower_ui_audit
npm ci
npx playwright install --with-deps chromium
npm run db:migrate
node scripts/ui-audit/seed.mjs
npm run build
npx playwright test --config scripts/ui-audit/playwright.config.mjs
```

Ports 3100/3101 and 8128 must be free. Playwright owns both servers and stops them after the run. The output directory defaults to `ui-audit-output/`, which is Git-ignored. Reseeding clears previous screenshots/results/diagnostics to prevent stale captures from masking failures.

## Maintaining coverage

`scripts/ui-audit/capture.spec.mjs` owns the page/flow scenario manifest, assertions, and gallery. Add an independent scenario for each meaningful new state; wait for its expected content before capturing. `seed.mjs` owns Bower database data, and `trellis.mjs` owns fake runtime responses. Update these fixtures together when a screen's data contract changes. Playwright and its Chromium revision are pinned through `package-lock.json`.
