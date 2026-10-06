# Deployments and recovery

These flows change what is running in production, so they follow the principles of [operational truth](../principles.md#1-tell-the-operational-truth) and [safe paths](../principles.md#6-make-the-safe-path-the-easy-path) most strictly.

## Deploy

- **Trigger:** Deploy (primary, `Rocket`) in the service header, or "Deploy {service}…" in the command palette.
- **Highlight:** while saved configuration differs from what is running, the header shows an **"Undeployed changes"** chip and Deploy is highlighted (A3-F04).
- **Confirmation shows what will change** (A3-F03), in an `lg` dialog:
  - Image: `v2.3.0 → v2.4.1` (mono tags).
  - Environment: one row per changed key, with an Added, Changed, or Removed chip and the value **masked** (A4-Q13).
  - Other fields as plain sentences, in **Running → After deploy** columns: "HTTP /healthz on 3000, every 10s", resources via `formatCpu` and `formatMemory` (A4-Q14).
  - Diffs are computed as structured data in `src/lib/service-config-diff.ts`, and formatted in the dialog, not in `lib`.
- **Creating a service doesn't deploy it.** The dialog says so (A1 P2-10).

## Rollback

| Where | Behavior |
| --- | --- |
| Service header "Roll back…" (default) | Opens a picker of **earlier successful releases**. Never the release that is running now (A3-F01, A3 B03) |
| Service › Deployments row | A ↺ icon button "Roll back to this release", only on eligible rows (A4-Q48) |
| Deployment page | "Roll back to {last good}" as **primary** when the deployment failed and a good release exists (A3-F21) |

- **Rollback dialog:** titled "Roll back Storefront?" with "Running v2.4.1" beneath. The picker has a visible **"Release"** label, with options in mono. It previews the same diff table as Deploy (A4-Q16, A5-M15).
- **Confirm with the primary (brand) button.** Rollback is recovery, not destruction (A3-F02).
- **Eligibility** (`src/lib/service-releases.ts`): a successful, retained release with a stored spec for this service and environment, other than the running one. The server re-checks eligibility and permissions, and applies that exact spec.
- The release that is running now offers **no primary**: just "Roll back…" as a default button (A4-Q15).

## Failed and rolled-back deployments

The deployment page for a failed or automatically rolled-back deployment shows:

1. A compact **notice** under the header: **danger** for Failed, **warn** for Rolled back ("Rolled back automatically: <reason>", plus the scheduling or backoff diagnostics that led to it). It carries the failing allocation's **last log lines** (5–10) and "Open allocation". The allocation comes from the failure event (or one marked failed or unhealthy), never from an arbitrary event. When there are no lines, the notice says why: "The allocation produced no log output." for an empty result, "The allocation is no longer available, so its logs have expired." once Trellis has collected it, or "No allocation was recorded for this failure." In the last two cases the button reads **Open service**, because the allocation page would 404 (A3 B23, A4-Q45).
2. The primary action **"Roll back to {last good tag}"** when one exists, for a failed deployment. Otherwise there is no primary. "Redeploy" and "Edit configuration" are default buttons (A2-G7, A3-F21).
3. If a **newer deployment exists**, a neutral notice reads "Superseded by v2.4.1 · succeeded 1h ago · View", and the page shows **no primary action**, because a rollback would downgrade a healthy service (A5-C3).
4. **Changes from previous successful release:** the same before/after table the rollback dialog uses (Field · Previous release · This deployment). It appears only when there is an earlier successful release and something changed.
5. A Timeline of events. Each event's tone comes from its **type** (`src/lib/deployment-events.ts`), never from words in its message: `failed` and `reconciliation_error` are danger; `auto_rollback`, `scheduling_blocked`, and `replacement_backoff` are warning; `healthy` and `canary_complete` are success. Payload details are collapsed and shown as key and value pairs (A1 P1-13).

**Before/after tables** (deploy and rollback dialogs, and the deployment page) are a bordered, rounded table inside the padded dialog body; an alert dialog that holds a `DialogBody` drops its default gap, so there is no extra band around the table. Plain environment variables show their values. Variables bound from secrets show `••••••••` and are never revealed. A value that the stored release did not record reads *Not recorded*, which is different from *None*: it does not mean the limit or health check would be removed. The Added/Changed/Removed chip follows the variable name.

A failed or rolled-back deployment appears in **Needs attention** only while it is the service's newest deployment (A4-Q01). The service header shows the warning marker for either outcome ("Last deploy failed" or "Last deploy rolled back").

## Failing services

- The status chip reads **"Failing ⓘ"** and opens a popover on click or keyboard (A3-L19, A5-H6):
  - Title "Failing". Beneath it, "Restart pending · next attempt in 30s". The countdown (`RestartCountdown`, built on `Time` live mode) shows seconds only under a minute, then whole minutes, and reads "restarting" once the time has passed, never "0s".
  - Actions: **Restart now** (hidden from viewers) and **View logs**.
- The cause is shown **once, in the Overview body**, as a one-line danger notice (`ServiceFailureNotice`): the cause, the restart countdown, and View logs. The popover holds the replica count, the countdown, and actions. A service whose allocations cannot be placed reads "Cannot be placed" with Trellis's reason rather than "Deploying". Failing rows in **Current allocations** show their reason or message beneath the status.
- A service reports **Deploying** only while a deployment is in progress or its allocations are actually moving. An allocation that has waited for placement past one minute, or that has a placement-failure reason, counts as failing (`src/lib/service-health.ts`).
- On the Status page, the "Restart pending" table lists Service · Failures · Last failure · Next restart, with "Restart now" per row (A4-Q51). Services Bower doesn't own show the job name with its namespace beneath.

## Live data

Pages that show health (Home, project Overview, Services, service pages, allocation pages, Status) refresh themselves while visible through `DeploymentPoller`: every 15 seconds, or every 5 while a deployment is in progress. It pauses in background tabs, offline, behind an open dialog, and while a form has unsaved changes, and backs off (to one minute) when refreshes are slow. Metric cards say "Sampled 5s ago", describing the sample, not the whole page.

## Restart and stop

- **Restart** (service header, default button) asks Trellis for a job-level restart. Allocations are drained and replaced without changing the specification (verified in the A1 portal review). Confirm with a primary button, and explain that running allocations will be replaced.
- **Stop** (an allocation) uses a destructive-style confirmation that explains the scheduler may replace the allocation.

## Node drain

- **Drain node** and **Resume scheduling** are in the `⋯` menu (A3-L16, A4-Q12). They are actions, named for what they do (A1 P0-09).
- The confirmation explains the effect on allocations, including how many will be moved.
- Show the drain with a status chip: Draining (warn), then Drained (neutral, "No allocations left. Ready for maintenance.") (A4-Q11). The node page lists the allocations still on it.
- If Trellis doesn't provide a start time, show "—" rather than inventing one (A3 B21).
