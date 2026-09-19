# Managed ingress

Bower manages a reverse proxy per Trellis namespace, so services can be exposed via HTTP/HTTPS routes without manually authoring proxy jobs.

## Domains and routes

Domain ownership is organization-wide, while routing is project-scoped.

Organization owners and admins add DNS domains under **Settings → Domains**. Bower verifies ownership with a TXT record at `_bower.<domain>`. A managed domain may be an apex such as `example.com` or a delegated subtree such as `internal.example.com`.

Once verified, project admins can create routes using the domain itself or hostnames beneath it. A hostname may only be claimed by one project/environment in an organization; multiple path routes within that same project/environment are allowed.

Existing routes created before domain management was introduced continue to run, but new routes and hostname changes must use a verified organization domain.

## How it works

When a route is created or updated, Bower:

1. Validates that the hostname is covered by a verified organization domain and is not claimed by another project/environment
2. Generates a Caddyfile for the route configuration and writes it as a Trellis namespace secret
3. Deploys (or updates) a two-task task group in the namespace: a Caddy instance and a route-sync agent
4. The sync agent uses `api_access: namespace/read` to watch healthy allocations via labels, renders upstream addresses, and reloads Caddy through its admin API
5. The proxy is considered healthy only after route-sync has recently fetched Trellis state and Caddy has accepted the generated configuration

The proxy job is managed infrastructure — it appears in the Bower UI but is not shown as a user service. Bower writes an initial Caddy configuration containing the known hostnames and TLS settings before route discovery succeeds. Until healthy upstreams are discovered, those routes return `503 No healthy upstream allocations` rather than a generic HTTP 200 placeholder, so HTTPS can initialize without making a broken proxy look ready.

## TLS

| Mode | Behaviour |
|---|---|
| `auto` | Caddy obtains and renews certificates automatically via ACME |
| `custom` | Caddy reads a certificate and key from a Trellis secret you provide |
| `none` | HTTP only |

## Access protection

Protection is configured per route and enforced by the managed proxy before traffic reaches the service:

| Mode | Behaviour |
|---|---|
| `Public` | No authentication is required. |
| `Password` | Visitors are sent to Bower's route-password screen and enter only the password configured on the route. Use this mode only with HTTPS. |
| `Bower account (Viewer+)` | Visitors sign in through Bower. Bower grants access only while the user has Viewer, Deployer, or Admin access to the route's project. |

Password and Bower-account protection require `BOWER_PUBLIC_URL` and `BOWER_ROUTE_AUTH_SECRET`. The proxy redirects the browser to Bower, then receives a short-lived route-scoped cookie through `/.bower/auth/callback`; deployment configuration and application containers are not modified.

## DNS

Bower uses DNS only to verify that the organization controls a managed domain and to tell you what traffic record to create for a route. It does not create, modify, or delete DNS records itself.

For domain verification, create the TXT record shown in **Settings → Domains**. For a project route, Bower tells you what traffic record to create (for example, `api.example.com CNAME node-1.cluster.example.com`).

## Canary weight

The sync agent reads the `trellis/weight` label on allocations and passes the value to Caddy as an upstream weight. This is how canary deployments shift traffic gradually — no manual proxy config required.

## Overriding proxy images

The proxy images are published alongside Bower releases. Override them when pulling from a private registry:

```bash
BOWER_CADDY_IMAGE=registry.example.com/bower-caddy:latest
BOWER_PROXY_SYNC_IMAGE=registry.example.com/bower-proxy-sync:latest
```

The source for both images is under `proxy/` in this repository.

## Host ports

The proxy binds to host ports 80 and 443 by default. Change them with:

```bash
BOWER_PROXY_HTTP_PORT=8080
BOWER_PROXY_HTTPS_PORT=8443
```
