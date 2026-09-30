# Deployment strategies

Bower supports four deployment strategies, selectable per service. All are implemented on top of Trellis job primitives.

## Rolling (default)

Uses Trellis's native rolling update strategy with `max_parallel: 1`, including services with just one replica. Trellis can temporarily run one replacement above the desired count while waiting for it to become healthy; rolling therefore needs spare capacity and allows old and new instances to overlap. Bower does not silently switch a one-replica rolling service to recreate. Single-replica rolling requires Trellis's [September 20, 2026 support change](https://github.com/overfold/trellis/commit/3e4a63c4053373b9b7b5f458a3079fbb0038c944) or later.

Bower watches allocation health during the rollout and records convergence events. Job acceptance alone is not a readiness guarantee.

Best for: stateless web services where brief mixed-version traffic is acceptable.

## Recreate

Uses Trellis's native recreate strategy — all existing allocations are stopped before new ones start.

Best for: services that cannot run two versions simultaneously (e.g., a worker that holds an exclusive lock).

## Blue-green

Bower alternates between `{service}-blue` and `{service}-green`, waits for all new allocations to pass health checks, switches the managed route to the new job, then deletes the old job. Traffic switches atomically.

Updates within either underlying Trellis job use rolling with `max_parallel: 1`, even at one replica. Bower owns the traffic switch between jobs, not a native Trellis blue-green strategy.

Best for: services where zero mixed-version traffic is required and a brief capacity increase is acceptable.

## Canary

Bower creates an alternating canary job (`{service}-canary-a` or `{service}-canary-b`) alongside the active job. The canary starts with a low replica count and a `trellis/weight` label. Over configurable steps, Bower increases the weight and replica count while monitoring allocation health. Once the canary reaches 100%, managed routes switch to it and the previous job is removed.

Updates within each underlying canary job use rolling with `max_parallel: 1`, including its initial one-replica stage. Traffic weights and steps remain Bower-level orchestration.

Best for: high-traffic services where gradual traffic shifting and automatic rollback is needed.

## Automatic rollback

Bower's background reconciler monitors allocation health throughout a rollout. When it detects an unhealthy rollout beyond the service's failure grace period (default: 5 minutes), it attempts to re-apply the previous known-good job spec, if one is stored, and records a `rolled-back` deployment after submission. This is not a guarantee of full-replica convergence or successful recovery: a first deployment has no previous spec, pending/empty allocation timeouts can be marked failed without rollback, and reapplying a spec still requires Trellis to place and start healthy allocations. `BOWER_RECONCILE_INTERVAL` controls how often Bower checks, not the grace period.
