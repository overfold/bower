# Deployment strategies

Bower supports four deployment strategies, selectable per service. All are implemented on top of Trellis job primitives.

## Rolling (default)

Uses Trellis's native rolling update strategy. Bower watches allocation health during the rollout and records convergence events.

Best for: stateless web services where brief mixed-version traffic is acceptable.

## Recreate

Uses Trellis's native recreate strategy — all existing allocations are stopped before new ones start.

Best for: services that cannot run two versions simultaneously (e.g., a worker that holds an exclusive lock).

## Blue-green

Bower alternates between `{service}-blue` and `{service}-green`, waits for all new allocations to pass health checks, switches the managed route to the new job, then deletes the old job. Traffic switches atomically.

Best for: services where zero mixed-version traffic is required and a brief capacity increase is acceptable.

## Canary

Bower creates an alternating canary job (`{service}-canary-a` or `{service}-canary-b`) alongside the active job. The canary starts with a low replica count and a `trellis/weight` label. Over configurable steps, Bower increases the weight and replica count while monitoring allocation health. Once the canary reaches 100%, managed routes switch to it and the previous job is removed.

Best for: high-traffic services where gradual traffic shifting and automatic rollback is needed.

## Automatic rollback

Regardless of strategy, Bower's background reconciler monitors allocation health throughout a rollout. If allocations remain unhealthy beyond the service's failure grace period (default: 5 minutes), Bower re-applies the previous known-good job spec and records the event as a `rolled-back` deployment in the audit history. `BOWER_RECONCILE_INTERVAL` controls how often Bower checks, not the grace period.
