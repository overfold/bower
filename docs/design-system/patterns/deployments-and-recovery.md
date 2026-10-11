# Deployments and recovery

These flows change what is running in production, so they follow the principles of [operational truth](../principles.md#1-tell-the-operational-truth) and [safe paths](../principles.md#6-make-the-safe-path-the-easy-path) most strictly.

## Deploy

- **Trigger:** Deploy (primary, `Rocket`) in the service header, or "Deploy {service}…" in the command palette.
- **Highlight:** while saved configuration differs from what is running, the header shows an **"Undeployed changes"** chip and Deploy is highlighted (A3-F04).
- **Confirmation shows what will change** (A3-F03), in an `lg` dialog:
  - Image: `v2.3.0 → v2.4.1` (mono tags).
  - Environment: one row per changed key, with an Added, Changed, or Removed chip and the value **masked** (A4-Q13).
  - Columns are **Field · Before · After** everywhere (M3); missing values read **Not set**. Non-variable fields remain plain, with resources via `formatCpu` and `formatMemory`.
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

1. A compact **notice** under the header: **danger** for Failed, **warn** for Rolled back ("Rolled back automatically: <reason>", plus scheduling/backoff diagnostics). Keep the existing layout (L9). It carries the failing allocation's last log lines and **View allocation** (C20c); excerpts share allocation logs' local line-timestamp formatter (C7). Choose the allocation from the failure event or one marked failed/unhealthy, never an arbitrary event. When no logs exist, explain whether none were produced, logs expired, or no allocation was recorded. For unavailable/unrecorded allocations, keep **Open service** rather than linking to a 404.
2. The primary action **"Roll back to {last good tag}"** when one exists, for a failed deployment. Otherwise there is no primary. "Redeploy" and "Edit configuration" are default buttons (A2-G7, A3-F21).
3. If a **newer deployment exists**, a neutral notice reads "Superseded by v2.4.1 · succeeded 1h ago · View", and the page shows **no primary action**. View uses shared text-link styling, brand with no resting underline (C29).
4. **Changes from previous successful release:** the same **Field · Before · After** table as Deploy and Rollback (M3). It appears only when there is an earlier successful release and something changed.
5. A Timeline of events. Each event's `Tone` comes from its **type**, never words in its message: failures are danger; `auto_rollback`, `scheduling_blocked`, and `replacement_backoff` are warn, not `warning` (M1); healthy outcomes are success. Planning events read **Planned the deployment**, with the technical stored message in Details, including old events (K1).

**Before/after tables** use shared `ConfigDiffPreview`: a bordered, rounded table inside the padded body, with **Field · Before · After** in every context. Missing values read **Not set** (M3), never a dash or context-specific missing label. All environment values are `••••••••` with per-row Reveal where readable; write-only shared values stay locked and unrevealable (T9). Non-variable fields stay plain. Keep Added/Removed chips with their primitive-owned dot (R2). Caller-specific before/after labels must not override the shared headings.

A failed or rolled-back deployment appears in **Needs attention** only while it is the service's newest deployment (A4-Q01). The service header shows the warning marker for either outcome ("Last deploy failed" or "Last deploy rolled back").

## Failing services

- The chip is plain **Failing**, without ⓘ, popover, or hover affordance (L1).
- One body notice holds the cause as title; "N failures · next restart in 30s · X of Y replicas ready" as secondary line; and **Restart now** plus **View logs** as applicable. Use `RestartCountdown` for a scheduled restart. Allocation notices share this anatomy (L3), while Current allocations retains each row's status and message.
- Capacity failures (`insufficient_capacity`, also fixture `insufficient_cpu`) explain "No node has room for this service" and the per-replica core request. Actions are **Edit resources** (Configuration Resources) and **View cluster status** (`/status`). Header Restart is disabled with "Restarting won't help until there is room to place it." (T6).
- A service reports **Deploying** only while a deployment is in progress or its allocations are actually moving. An allocation that has waited for placement past one minute, or that has a placement-failure reason, counts as failing (`src/lib/service-health.ts`).
- On the Status page, the "Restart pending" table lists Service · Failures · Last failure · Next restart, with "Restart now" per row (A4-Q51). Services Bower doesn't own show the job name with its namespace beneath.

## Live data

Pages that show health (Home, project Overview, Services, service pages, allocation pages, Status) refresh themselves while visible through `DeploymentPoller`: every 15 seconds, or every 5 while a deployment is in progress. It pauses in background tabs, offline, behind an open dialog, and while a form has unsaved changes, and backs off (to one minute) when refreshes are slow. Metric cards describe the sample, not the page: "Sampled just now" under about 10s, with Sampling while CPU awaits its second sample (T2/T3/C9).

## Restart and stop

- **Restart** (service header, default button) asks Trellis for a job-level restart. Allocations are drained and replaced without changing the specification (verified in the A1 portal review). Confirm with a primary button, and explain that running allocations will be replaced.
- **Stop** is for running/placed/starting allocations. Pending offers **Cancel**, confirming **Cancel placement?**, with the same stop operation and audit recording; failed hides the action; stopping/stopped/lost retain disabled behavior (T5). Stop uses a destructive-style confirmation explaining replacement.
- Terminal is disabled when not running, with "Terminal is available while the allocation is running." Direct exec access must also be guarded on the server (T4).

## Node drain

- **Drain node** and **Resume scheduling** are in the `⋯` menu (A3-L16, A4-Q12). They are actions, named for what they do (A1 P0-09).
- The confirmation explains the effect on allocations, including how many will be moved.
- Show the drain with a status chip: Draining (warn), then Drained (neutral, "No allocations left. Ready for maintenance.") (A4-Q11). The node page lists the allocations still on it.
- If Trellis doesn't provide a start time, show "—" rather than inventing one (A3 B21).
