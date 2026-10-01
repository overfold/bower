# Configuration

All configuration is via environment variables. Copy `.env.example` at the repo root for a starting point.

## Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgres://bower:bower@localhost:5432/bower` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 32-byte hex key used to encrypt server action payloads. Must be identical across all Bower instances in a multi-instance deployment. Generate with `openssl rand -hex 32`. |
| `BOWER_PUBLIC_URL` | Public origin of the Bower instance, such as `https://bower.example.com`. It must be reachable from managed ingress proxies and is required for protected routes. |
| `BOWER_ROUTE_AUTH_SECRET` | Secret of at least 32 characters used to sign route-scoped access grants. Must be identical across all Bower instances. Generate with `openssl rand -hex 32`. Required for protected routes. |

## Trellis credentials

Bower has two distinct Trellis credential modes:

- The native [`trellis.yml`](../trellis.yml) deployment uses `api_access`. Trellis injects `TRELLIS_ADDR`, `TRELLIS_TOKEN`, and, when applicable, `TRELLIS_CA_CERT` into each allocation. Bower resolves these values at request time for the bootstrap organization and never persists them. The token belongs to one allocation generation: Trellis replaces and revokes it when that generation is replaced. Each Bower replica uses its own injection. Schemeless `TRELLIS_ADDR` values are treated as HTTPS, and `TRELLIS_CA_CERT` is used as a trust root for that connection without disabling certificate verification.
- Connections entered in organization settings, or initially supplied with `TRELLIS_API_URL` and `TRELLIS_API_TOKEN`, are durable operator credentials stored for that organization. Runtime workload injection does not override them. Supplying both URL and token in the bootstrap organization's cluster settings explicitly switches it to durable credentials.

`TRELLIS_ADDR`, `TRELLIS_TOKEN`, and `TRELLIS_CA_CERT` are Trellis-owned workload injection variables; do not copy them into durable configuration. `TRELLIS_API_URL` and `TRELLIS_API_TOKEN` are optional bootstrap inputs for a Bower instance running outside native `api_access`.

## Managed ingress

| Variable | Default | Description |
|---|---|---|
| `BOWER_CADDY_IMAGE` | `ghcr.io/overfold/bower-proxy:latest` | Caddy image used for the per-namespace proxy job. Override when pulling from a private registry. |
| `BOWER_PROXY_SYNC_IMAGE` | `ghcr.io/overfold/bower-proxy-sync:latest` | Route-sync task image. Override when pulling from a private registry. |
| `BOWER_PROXY_HTTP_PORT` | `80` | Host port for the managed ingress HTTP listener. |
| `BOWER_PROXY_HTTPS_PORT` | `443` | Host port for the managed ingress HTTPS listener. |

## Reconciliation

| Variable | Default | Description |
|---|---|---|
| `BOWER_RECONCILE_INTERVAL` | `5` | How often (in seconds) the background reconciler checks active rollouts, advances canary steps, and triggers auto-rollback. |

## Workload trust policy

Bower project admins are tenant administrators, not Trellis cluster operators. Only Bower instance admins are eligible to act as cluster operators. Project admins can manage workloads inside their project's namespace, including namespace networking and namespace-scoped read-only workload API access. By default nobody can use Bower to mount arbitrary absolute host paths or grant a workload cluster-scoped or write API credentials; those capabilities escape or can mutate the namespace boundary.

| Variable | Default | Description |
|---|---|---|
| `BOWER_IA_BYPASS_MULTITENANCY` | `false` | Set to the exact value `true` to let instance admins use non-multitenancy-safe workload features: absolute host paths plus cluster-scoped and write workload API grants. Non-instance-admins remain denied. The policy is enforced when settings are saved and the flag is checked again when a deployment spec is built. |

This is a global operator decision, not a per-project convenience setting. Keep it disabled for multitenant installations. Bower continues to force application workloads onto Trellis namespace networking regardless of this setting.
