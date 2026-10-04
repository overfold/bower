# Bower

A deployment dashboard for [Trellis](https://github.com/overfold/trellis).

Bower adds application-platform concepts on top of Trellis: projects, environments, services, deployments, routes, volumes, secrets, teams, and an audit trail. Trellis still handles scheduling, placement, and the container lifecycle.

- [Features](#features)
- [Requirements](#requirements)
- [Deploy on Trellis](#deploy-on-trellis)
- [Local development](#local-development)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Features

- **Projects and environments.** Group work and share settings. Each environment maps to its own Trellis namespace.
- **Services.** Application workloads that map to Trellis jobs and task groups.
- **Deployments.** History with plan diffs, step-by-step canary rollouts, and automatic rollback when health checks fail.
- **Managed ingress.** One shared Caddy proxy per cluster. When you add a route, Bower updates the proxy and reloads it.
- **Secrets.** Stored as Trellis namespace secrets. Bower tracks metadata and rotation but never stores the values.
- **Access control.** Owner, Admin, Deployer, and Viewer roles, scoped per project.
- **Audit log.** Records every change with who made it, when, and the state before and after.
- **CI/CD hooks.** A deploy endpoint and registry webhooks, verified with HMAC signatures.

## Requirements

- A running Trellis cluster and a credential with `cluster/write` access.
- For local development: Node.js 22, npm, and PostgreSQL (for example, through Docker).

## Deploy on Trellis

The root [`trellis.yml`](trellis.yml) deploys Bower, a bundled Postgres container, and shared ingress. You don't need to clone the repository.

This manifest targets a **single-node** cluster:

- Bower and Postgres communicate over private namespace networking.
- Ingress uses host networking on ports 80 and 443.
- Postgres data survives container crashes but is stored on the node. It does not replace backups or high availability.

For a multi-node or production deployment, use an external Postgres instance and set `DATABASE_URL` to its connection string.

### 1. Download and edit the manifest

```bash
curl -fsSL https://raw.githubusercontent.com/overfold/bower/main/trellis.yml -o bower.yml
```

Open `bower.yml` and review these settings:

- **Dashboard URL.** In the web task's `env` block, uncomment `BOWER_PUBLIC_URL` and set it to your public origin, such as `https://bower.example.com`. Then:
  - Point the hostname's DNS A record at the ingress node, and make sure any AAAA record reaches it too.
  - Allow inbound TCP on ports 80 and 443.

  Caddy obtains the HTTPS certificate automatically. If you leave `BOWER_PUBLIC_URL` commented out, Bower is served over HTTP only at `http://<node-ip>`.
- **Database credentials.** Replace the example `POSTGRES_PASSWORD` and use the same password in `DATABASE_URL`, URL-encoded. If Postgres has already initialized its data directory, changing these values does not change its credentials. To use an external database, remove the `db` task group and point `DATABASE_URL` at it.
- **Images and resources.** The manifest uses the `latest` Bower and proxy images with small CPU and memory allocations. Pin image versions and adjust resources as needed.

Keep the `platform` namespace. If you change it, you also need to update the database hostname, `BOWER_PROXY_NAMESPACE`, and the namespace in the commands below. The [configuration reference](docs/configuration.md) lists every other setting.

### 2. Create the encryption key

```bash
openssl rand -hex 32 | trellisctl --namespace platform secrets set encryption-key --stdin
```

Create this key only once, and keep it when you update Bower. Every Bower instance must use the same key.

### 3. Apply the manifest

```bash
trellisctl --namespace platform jobs apply ./bower.yml --wait
```

Keep your edited `bower.yml` for future updates. If you apply the manifest straight from GitHub, your settings are replaced by the repository defaults.

### 4. Create the first account

On first startup, Bower:

- creates a default organization that is already connected to the cluster, using the Trellis credentials injected through `api_access`;
- creates the shared `platform/bower-ingress` job, which serves the dashboard and application routes on ports 80 and 443;
- prints a single-use admin invitation link in its logs.

Find the `Bower — First Run Setup` banner in the logs:

```bash
trellisctl --namespace platform jobs logs bower --tail 50
```

Open the invitation link at your `BOWER_PUBLIC_URL`, or at `http://<node-ip>` if you didn't set one, and create the first account. Ingress can take a moment to become healthy, and HTTPS can take a little longer while the certificate is issued. Port 3000 stays open for troubleshooting.

If you want application routes that require a Bower login, set both `BOWER_PUBLIC_URL` and `BOWER_ROUTE_AUTH_SECRET`. See the [configuration reference](docs/configuration.md).

### Container images

Tagged releases publish `ghcr.io/overfold/bower:<version>` and update `ghcr.io/overfold/bower:latest`. The container listens on port 3000 and runs as a non-root user.

With `AUTO_MIGRATE=true`, which the quick-start manifest sets, the container applies pending database migrations on startup. Otherwise, run `npm run db:migrate` before you start a new version. For details, see [Database migrations](docs/database-migrations.md).

## Local development

### 1. Start Postgres

Save this as `docker-compose.yml`, or use any local PostgreSQL that matches the `DATABASE_URL` in `.env.example`:

```yaml
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

### 2. Configure and run Bower

```bash
cp .env.example .env.local
# Set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY to the output of: openssl rand -hex 32
npm ci
npm run dev
```

The default `DATABASE_URL` points at the compose service above. Because `AUTO_MIGRATE=true`, Bower runs pending migrations on startup.

Run `npm run dev` rather than `next dev`. `exec/server.mjs` sits in front of Next.js and handles terminal WebSockets.

### 3. Connect a cluster

The dev server prints a single-use admin invitation link on first startup. Open it, accept the invitation, and then add your Trellis API URL and operator token under **Organization → Cluster**.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint, including design-system rules |
| `npx tsc --noEmit` | Type-check the project |
| `npm test` | Run the test suite |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |

## Documentation

- [Configuration](docs/configuration.md): environment variables, defaults, and Trellis credentials
- [Database migrations](docs/database-migrations.md): automatic and manual migrations, and schema changes
- [Deployment strategies](docs/deployment-strategies.md): rolling, recreate, blue-green, canary, and automatic rollback
- [Managed ingress](docs/managed-ingress.md): routes, domains, and how the Caddy proxy works
- [CI/CD automation](docs/automation.md): the deploy API and registry webhooks
- [Terminal](docs/terminal.md): the in-browser terminal and its WebSocket bridge
- [Design system](docs/design-system/README.md): UI principles, tokens, components, and patterns

## Contributing

[AGENTS.md](AGENTS.md) explains the repository layout, conventions, and the checks to run before you open a pull request. For UI changes, also follow the [design system guide](docs/design-system/README.md). CI runs `npm run lint` and `npm test`.
