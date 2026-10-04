# Configuration

All configuration is via environment variables. Copy `.env.example` at the repo root for a starting point.

## Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgres://bower:bower@localhost:5432/bower` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 32-byte hex key used to encrypt server action payloads. Must be identical across all Bower instances in a multi-instance deployment. Generate with `openssl rand -hex 32`. |
| `BOWER_PUBLIC_URL` | Public origin of the Bower instance, such as `https://bower.example.com`. It must be reachable from managed ingress proxies and is required for protected routes. |
| `BOWER_ROUTE_AUTH_SECRET` | Secret of at least 32 characters used to sign route-scoped access grants. Required, together with `BOWER_PUBLIC_URL`, for both password- and Bower-account-protected routes; not needed for public routes. Must be identical across all Bower instances and stable across updates. Generate with `openssl rand -hex 32`. Changing it invalidates existing route-access grants. |

The native `trellis.yml` maps the `platform` secret `route-auth-secret` to `BOWER_ROUTE_AUTH_SECRET` in the Bower task. This is separate from `encryption-key` / `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Create both secrets before applying the default manifest; see [Create the deployment secrets](installation.md#2-create-the-deployment-secrets). Existing installations must add the route-auth secret mapping and redeploy to enable protected routes. Never store secret values in the manifest.

## Trellis credentials

Bower has two distinct Trellis credential modes:

- The native [`trellis.yml`](../trellis.yml) deployment uses `api_access`. Trellis injects `TRELLIS_ADDR`, `TRELLIS_TOKEN`, and, when applicable, `TRELLIS_CA_CERT` into each allocation. Bower resolves these values at request time for the bootstrap organization and never persists them. The token belongs to one allocation generation: Trellis replaces and revokes it when that generation is replaced. Each Bower replica uses its own injection. Schemeless `TRELLIS_ADDR` values are treated as HTTPS, and `TRELLIS_CA_CERT` is used as a trust root for that connection without disabling certificate verification.
- Connections entered in organization settings, or initially supplied with `TRELLIS_API_URL` and `TRELLIS_API_TOKEN`, are durable operator credentials stored for that organization. Runtime workload injection does not override them. Supplying both URL and token in the bootstrap organization's cluster settings explicitly switches it to durable credentials.

`TRELLIS_ADDR`, `TRELLIS_TOKEN`, and `TRELLIS_CA_CERT` are Trellis-owned workload injection variables; do not copy them into durable configuration. `TRELLIS_API_URL` and `TRELLIS_API_TOKEN` are optional bootstrap inputs for a Bower instance running outside native `api_access`.

## Managed ingress

| Variable | Default | Description |
|---|---|---|
| `BOWER_CADDY_IMAGE` | `ghcr.io/overfold/bower-proxy:latest` | Caddy image used for the shared ingress job. Override when pulling from a private registry. |
| `BOWER_PROXY_SYNC_IMAGE` | `ghcr.io/overfold/bower-proxy-sync:latest` | Route-sync task image. Override when pulling from a private registry. |
| `BOWER_PROXY_HTTP_PORT` | `80` | Host port for the managed ingress HTTP listener. |
| `BOWER_PROXY_HTTPS_PORT` | `443` | Host port for the managed ingress HTTPS listener. |
| `BOWER_PROXY_NAMESPACE` | `platform` | Trusted infrastructure namespace containing the shared `bower-ingress` job and its secrets. |
| `BOWER_PROXY_DASHBOARD_UPSTREAM` | automatic discovery | Optional dashboard upstream URL for Bower running outside the native manifest. It must be reachable from the ingress node; do not point it at ingress itself. |

Bower reconciles one host-networked `bower-ingress` job per connected cluster, including before any application route exists. Organizations using the same normalized Trellis API origin share ingress. Use the same API endpoint for every organization connected to a given cluster; different endpoint aliases are not automatically recognized as the same cluster. Only one Bower installation should manage ingress on a cluster.

On Bower's home cluster (`TRELLIS_ADDR`, or `TRELLIS_API_URL` outside native deployment), ingress discovers healthy `bower` job allocations in `TRELLIS_NAMESPACE` (default `platform`) on port 3000. Set the upstream override for a differently named or non-Trellis Bower deployment. `BOWER_PUBLIC_URL` selects the dashboard hostname and HTTP/HTTPS scheme. Without it, the HTTP listener's unmatched hosts serve the dashboard, allowing first-run setup at `http://<node-ip>`. Application routes cannot claim the dashboard hostname or overlapping hostnames belonging to other environments on the same cluster. Deleting an environment's last route or a project does not delete shared ingress.

The proxy discovers each routed namespace separately and uses namespace-qualified job/service identities. If any discovery request fails, it retains the last accepted configuration rather than loading a partial route set. Host-networked ingress reaches private task addresses on their listening ports across namespace networks; application namespaces remain isolated from one another.

### Custom TLS and upgrading existing installations

Trellis secret reads return metadata only. Bower therefore copies PEM certificates and private keys into the ingress namespace at upload time, using names derived from the source namespace and secret name. Ordinary non-PEM secrets are not copied, and ingress mounts only TLS secrets referenced by routes. Certificate rotations are reconciled into a replacement ingress allocation. Removing a secret or project also removes its ingress copies.

For an existing installation, publish matching Bower, Caddy, and proxy-sync images before deploying this change. Re-upload each custom TLS certificate/key through updated Bower before switching traffic to shared ingress. Resolve hostname overlaps across organizations connected to the same cluster. Stop/delete the old per-environment `bower-proxy` jobs so they release ports 80/443; Bower does not automatically delete those existing jobs. Their old `BOWER_CADDYFILE` secrets are no longer needed once those jobs are removed: shared ingress carries bootstrap configuration in its fenced job revision. The dashboard's port-3000 endpoint can be used during the transition.

Ingress uses `recreate` updates so one node can reuse ports 80/443. Route-definition and certificate changes can therefore cause a brief interruption; there is no zero-downtime ingress replacement on a single node. The quick-start manifest also moves Postgres onto the private `platform` namespace network, without publishing its database port.

## Reconciliation

| Variable | Default | Description |
|---|---|---|
| `BOWER_RECONCILE_INTERVAL` | `5` | How often (in seconds) the background reconciler checks active rollouts, advances canary steps, and triggers auto-rollback. |

## Workload trust policy

Bower project admins are tenant administrators, not Trellis cluster operators. Only Bower instance admins are eligible to act as cluster operators. Project admins can manage workloads inside their project's namespace, including namespace networking. Trellis API tokens are always cluster-wide, even for read-only access. By default nobody can use Bower to mount arbitrary absolute host paths or grant application workloads any API credentials; those capabilities escape the namespace boundary.

| Variable | Default | Description |
|---|---|---|
| `BOWER_IA_BYPASS_MULTITENANCY` | `false` | Set to the exact value `true` to let instance admins use non-multitenancy-safe workload features: absolute host paths plus cluster-wide read or write workload API grants. Non-instance-admins remain denied. The policy is enforced when settings are saved and the flag is checked again when a deployment spec is built. |

This is a global operator decision, not a per-project convenience setting. Keep it disabled for multitenant installations. Bower continues to force application workloads onto Trellis namespace networking regardless of this setting.

The cluster-only token migration disables existing namespace-scoped application workload grants, including environment overrides, rather than escalating them to cluster-wide access. Existing cluster grants are preserved. An instance admin must explicitly re-enable any disabled grant with the bypass enabled. This changes future deployment specs; replace already-running workloads to stop using old credentials.

Bower's shared managed ingress is trusted cross-namespace infrastructure and uses `cluster/read` independently of this application workload bypass. Its sync agent queries the namespaces participating in routing, including the dashboard namespace on the home cluster.
