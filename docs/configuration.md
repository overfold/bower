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
