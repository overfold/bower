# Status and health

Status is the most important information in Bower. It also drifted the most across audits, so it has the strictest rules.

**Single source:** `src/lib/status.ts` maps every status key to its label, tone, and in-progress flag. Components (`StatusDot`, `DeploymentStatus`, `AllocationStatus`) read from it. Never write a page-local label or tone map (A3 B12).

## Tone meanings

| Tone | Meaning | Examples |
| --- | --- | --- |
| `success` (green) | Working as intended | Healthy, Succeeded, Running, Active, Verified, Applied |
| `danger` (red) | Broken, needs a fix | Failing, Failed, Unhealthy, Lost, Error, Stale heartbeat |
| `warn` (amber) | Someone should look | Draining, Restart pending, Rolled back (the rollout failed and Bower restored the previous release), Undeployed changes, Last deploy failed (marker) |
| `info` (purple) | Neutral information in notices | Informational notices only; no status uses it |
| `neutral` + spinner | Happening now | Deploying, In progress, Pending, Starting, Placed |
| `neutral` | Settled, not a problem | Stopped, Completed, Drained, Not deployed, Unknown, Superseded |

In-progress states are **neutral with a spinner**, never amber or purple (A2-B4, A3-T05). Amber is reserved for attention so that people don't learn to ignore it (A1 P1-04).

## Vocabulary by object

### Service: live health

Derived from running allocations (`src/lib/service-health.ts`), **not** from the last deployment (A2-B1).

| Label | When |
| --- | --- |
| Healthy | All desired replicas are ready |
| Failing | Some or all replicas aren't running or are unhealthy. Opens the cause popover (A3-S01) |
| Deploying | A deployment is in progress (spinner) |
| Restart pending | Trellis is waiting before restarting after repeated crashes. Plain-language name for "replacement backoff" (A3-S05) |
| Stopped | Scaled to zero, or stopped on purpose |
| Not deployed | Never deployed (A1 P0-06) |

When a service is live but its **newest deployment failed** (the previous version is still serving), keep the live chip and add the `LastDeployFailed` warning marker beside it, linking to the deployment (A2-B2).

"Undeployed changes" is a separate `warn` chip in the service header. It appears when the saved configuration differs from what is running, and the Deploy button is highlighted at the same time (A3-F04).

### Project: aggregate health

| Label | When |
| --- | --- |
| Healthy | Every service is healthy |
| *N* of *M* failing | One or more services are failing (A3-S04) |
| No services | The project has no services. Don't show "Not deployed", which suggests something failed (A4-Q69) |

### Deployment: historical result

Rendered with `DeploymentStatus`.

| Label | Statuses |
| --- | --- |
| Succeeded | `healthy`, `succeeded`. Never "Healthy" (A2-B3, A3-S02) |
| Failed | `failed` |
| In progress | `pending`, `planning`, `deploying`, `rolling_back` (spinner) |
| Rolled back | `rolled_back` (`warn`). An automatic rollback means the rollout failed, so it notifies like a failure |

A deployment that a later one replaced shows a **neutral "Superseded by …" notice** on its page (A5-C3).

### Allocation: one chip

One chip: **health while running, otherwise the phase** (A2-B6, `allocationStatus()`).

| Label | When |
| --- | --- |
| Healthy / Unhealthy | Running, with health known |
| Running | Running, health unknown |
| Pending, Placed, Starting | Being scheduled or started (spinner) |
| Failed | Failed or dead: the allocation is terminal (`danger`) |
| Lost | The node stopped reporting the allocation (`danger`). Kept distinct from Failed |
| Failing | Service level only (`degraded`, `down`, `failing`): fewer replicas serve than desired. Never an allocation phase |
| Stopped | Stopped on purpose (not a failure) |
| Completed | A batch run that finished |

### Node

| Label | Tone | When |
| --- | --- | --- |
| Healthy | success | Ready and schedulable (A3-S03: not "Ready") |
| Draining | warn | Draining and still has allocations |
| Drained | neutral | Draining with no allocations left. The secondary line reads "No allocations left. Ready for maintenance." (A4-Q11) |
| Unhealthy | danger | Not ready, or the heartbeat is lost |

Node status is a **chip in its own column directly after the node name**, never a color dot alone (A2-H2).

### Cluster summary (Home card, Status summary)

| Chip or count | Tone |
| --- | --- |
| All healthy | success |
| *N* draining | warn |
| *N* drained | neutral |
| *N* unhealthy | danger |

The cluster summary must reflect drains and failures, not just connectivity (A1 P0-10, A5-M6). The Nodes tile reads "3 · 1 drained".

### Other states

| Object | Labels |
| --- | --- |
| Domain | Verified (success) · Pending verification (warn). A verified row's DNS cell is empty (A4-Q41) |
| Managed ingress | Applied (success) · Pending (neutral) (A4-Q52) |
| Invitation | Active · Accepted (single-use accepted, or the use limit reached) · Expired · Revoked. The role is a chip and the note goes on a second line (A5-M20) |
| Webhook, notification channel | Active |
| Heartbeat | "Last heartbeat 12s ago". A **Stale** chip (danger) appears only when stale (A5-M5) |

## Live versus history

**Never show live health in a history row, or a historical result as live health** (A3 B01).

| Surface | Shows |
| --- | --- |
| Deployments tables, deployment page, audit | Deployment result (Succeeded, Failed, …) |
| Service header, services list, project tiles, node and allocation rows | Live health |
| Needs attention | The symptom, with its own status |

## Needs attention

`src/components/needs-attention.tsx`, with rules in `src/lib/needs-attention.ts`. It appears on Home and, scoped to the project, on the project Overview (A4-Q06).

- **Table columns:** Status · What · Cause · Time · (action). Hidden entirely when there are no rows (A3-L02).
- **One row per symptom** (A4-Q02). **What** is the service's display name, with the specific ID (allocation, job, node) beneath in small mono (A4-Q03).
- **What qualifies:**
  - a failed deployment, **only if it is the service's newest** (A4-Q01)
  - failing allocations of the current version
  - services with a restart pending
  - nodes that are draining **and still have allocations**
- **One action per row**, as a small default button: View diagnostics, View logs, Review restart, View progress.
- When cluster data can't be read, say so ("Couldn't check the cluster"). Never "All clear" (A2-M1).

## Counts must agree

Numbers that describe the same thing must come from the same selector (A2-C2). For example, the "Allocation health" tile counts failed allocations of the current version, which matches Needs attention (A2-B7).

## Adding a status

1. Add the key to `statuses` in `src/lib/status.ts` with a sentence-case label, a tone, and `inProgress` if it is transient.
2. Pick the tone by meaning, using the table above. If no tone fits, the status probably isn't a status.
3. If it is a new deployment status, update `deploymentStatusLabels` in `src/lib/labels.ts`.
4. Extend the status contract in `src/lib/ui-contracts.test.ts`.
