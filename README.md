# Bower

Bower is an opinionated deployment dashboard built on top of [Trellis](https://github.com/overfold/trellis). It adds application-platform abstractions — projects, environments, services, deployments, routes, volumes, secrets, teams, and an audit trail — while leaving scheduling, placement, and container lifecycle entirely to Trellis.

## Features

- **Projects & environments** — logical grouping and inheritance scopes mapped to isolated Trellis namespaces
- **Services** — opinionated application workloads mapped to Trellis jobs and task groups
- **Deployments** — auditable history with plan diffs, canary step advancement, and automatic rollback on health failures
- **Managed ingress** — per-namespace Caddy proxy; adding a route writes the config and reloads automatically
- **Secrets** — backed by Trellis namespace secrets; Bower tracks metadata and rotation without storing values
- **RBAC** — Owner, Admin, Deployer, and Viewer roles scoped per project
- **Audit log** — every mutation recorded with actor, timestamp, and before/after state
- **CI/CD hooks** — inbound deploy endpoint and registry webhooks with HMAC verification

## Requirements

- A running Trellis cluster with a credential that has `cluster/write` access
- Node.js 20+ (local development only)

## Quick start

### On Trellis

Bower includes a root [`trellis.yml`](trellis.yml). Download it and edit the deployment settings before applying it; no clone is required.

The quick-start manifest includes a bundled Postgres container, uses private namespace networking for Bower and Postgres, and is intended for a single-node Trellis cluster. Shared ingress uses host networking on ports 80/443. For a multi-node or production deployment, use an external Postgres instance and adjust `DATABASE_URL` instead. The bundled database persists across container crashes, but its node-local data is not a substitute for a production database backup/HA strategy.

#### 1. Download and configure the manifest

```bash
curl -fsSL https://raw.githubusercontent.com/overfold/bower/main/trellis.yml -o bower.yml
# Open bower.yml in your editor before applying it.
```

Review these common settings:

- **Dashboard URL:** uncomment `BOWER_PUBLIC_URL` in the web task's `env` block and set it to your public origin, for example `https://bower.example.com`. Point the hostname's DNS A record at the ingress node, ensure any AAAA record reaches that node too, and allow inbound TCP ports 80/443. Caddy obtains the HTTPS certificate automatically. Leaving this setting commented out gives HTTP-only setup at `http://<node-ip>`; it does not enable HTTPS for the domain or bare IP.
- **Database credentials:** replace the example `POSTGRES_PASSWORD` and update the password in `DATABASE_URL` to match (URL-encode it in the connection string). For an external database, remove the `db` task group and set `DATABASE_URL` to its connection string. Changing these values does not change credentials in an already initialized Postgres data directory.
- **Images and resources:** the manifest uses `latest` Bower/proxy images and small CPU/memory allocations. Pin image versions and adjust resources as needed.

Keep the `platform` namespace for the quick start. If you change it, also update the database DNS hostname, `BOWER_PROXY_NAMESPACE`, and the namespace used for the encryption secret and apply commands. See the [configuration reference](docs/configuration.md) for additional settings.

#### 2. Set the encryption key secret

```bash
# Generate a stable 32-byte key and store it — it must be identical across all Bower instances.
openssl rand -hex 32 | trellisctl --namespace platform secrets set encryption-key --stdin
```

Generate this secret once; keep the existing key when updating an installation.

#### 3. Apply the edited manifest

```bash
trellisctl --namespace platform jobs apply ./bower.yml --wait
```

`trellisctl` validates the local manifest and applies it through the normal plan/apply path. Keep this edited file for subsequent updates; applying directly from GitHub would use the repository's defaults rather than your settings.

#### 4. Finish setup

On first startup Bower creates a default organization backed by the allocation's Trellis workload identity (injected via `api_access`) and prints a single-use instance admin token to the container logs. Retrieve it with:

```bash
trellisctl --namespace platform jobs logs bower --tail 50
```

Look for the `Bower — First Run Setup` banner containing the invitation link. Open that link using your configured `BOWER_PUBLIC_URL` (or `http://<node-ip>` for HTTP-only setup) to create the first account. Bower creates a shared `platform/bower-ingress` job on startup; it owns ports 80/443 and serves both the dashboard and application routes across namespaces. Allow a short delay for ingress to become healthy and, for HTTPS, for certificate issuance. Port 3000 remains available for troubleshooting. The Trellis connection is already configured — no manual cluster setup required. Bower resolves the address, token, and cluster CA from each running allocation rather than storing them in Postgres. When Trellis replaces an allocation generation, the replacement therefore uses its newly injected token; multiple Bower replicas likewise use their own credentials.

For Bower-account-protected application routes, also configure `BOWER_PUBLIC_URL` and `BOWER_ROUTE_AUTH_SECRET`; see the [configuration reference](docs/configuration.md).

### Local development

#### 1. Start Postgres

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: bower
      POSTGRES_PASSWORD: bower
      POSTGRES_DB: bower
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```

```bash
docker compose up -d
```

#### 2. Configure and run

```bash
cp .env.example .env.local
# Set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY to the output of: openssl rand -hex 32
# DATABASE_URL is already set to match the compose service above
npm install
npm run dev
```

On first startup the dev server prints a single-use instance administrator invitation link. Open the link, create an account if needed, and accept the invitation; then add the Trellis API URL and operator token under **Organization → Cluster**.

### Migrations

Both setup paths set `AUTO_MIGRATE=true`, which applies pending Drizzle migrations automatically on startup before the app begins serving traffic. No manual step is needed.

The Bower startup process runs migrations before launching Next.js or the front server. Transient DNS/connection failures and PostgreSQL-not-ready errors retry until the database becomes available, with exponential delays starting at two seconds and capped at 30 seconds, and a five-second connection timeout per attempt. Each failed connection is closed before waiting. Bower remains not ready while waiting, logs each retry without the connection string, and can be stopped normally with SIGTERM/SIGINT. Authentication, SQL, and other non-transient errors fail startup immediately with a nonzero exit status. A persistent DNS/configuration problem therefore remains visible as an unhealthy task with retry logs rather than a restart loop.

To run migrations manually instead, unset `AUTO_MIGRATE` and use `npm run db:migrate` with the appropriate `DATABASE_URL`:

```bash
# Local development (from the repo root)
npm run db:migrate

# Against a Trellis-deployed Postgres
DATABASE_URL="postgres://bower:bower@<node-ip>:5432/bower" npm run db:migrate
```

Generate new migrations with `npm run db:generate` after changing the schema. Commit the generated SQL, snapshot, and journal together; review the SQL before applying it. An unchanged schema should report “No schema changes, nothing to migrate”.

The snapshot history contains a consolidated baseline at `drizzle/meta/0023_snapshot.json` for the schema after `0024_notification_read_states`. It covers the handwritten migrations after `0005`; their intermediate snapshots are intentionally absent. Snapshot filenames use journal indices, not SQL filename prefixes (the SQL numbering skips `0007`). The baseline was checked against a fresh database built from the existing SQL migrations, including column defaults, enums, indexes, and constraint names/definitions. Existing migration SQL and journal timestamps were preserved. Custom SQL functions and triggers remain owned by the handwritten migrations, not Drizzle snapshots.

## Commands

```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm start            # Production server
npm run lint         # ESLint
npm test             # Test suite
npm run db:generate  # Generate a Drizzle migration from schema changes
npm run db:migrate   # Apply pending migrations
```

## Container image

Tagged releases publish `ghcr.io/overfold/bower:<version>` and update `ghcr.io/overfold/bower:latest`. The container listens on port 3000 and runs as a non-root user.

When `AUTO_MIGRATE=true` is set, the container applies pending migrations on startup. Otherwise, run `npm run db:migrate` before starting the new container.

## Further reading

- [Configuration reference](docs/configuration.md) — all environment variables and defaults
- [Deployment strategies](docs/deployment-strategies.md) — rolling, recreate, blue-green, canary, and auto-rollback
- [Managed ingress](docs/managed-ingress.md) — how the per-namespace Caddy proxy works
- [CI/CD automation](docs/automation.md) — deploy API and registry webhooks
- [Design system](docs/design-system/README.md) — UI principles, tokens, components, patterns, and audit records
