# Contributing to Bower

Thanks for helping improve Bower. This guide covers running Bower locally and the checks to run before you open a pull request. For bugs and feature requests, [open an issue](https://github.com/overfold/bower/issues).

[AGENTS.md](AGENTS.md) describes the repository layout and conventions in more detail. For UI changes, also follow the [design system guide](docs/design-system/README.md).

## Local development

You need Node.js 22, npm, and PostgreSQL. The steps below run Postgres with Docker.

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

The default `DATABASE_URL` points at the compose service above. Because `.env.example` sets `AUTO_MIGRATE=true`, Bower runs pending migrations on startup.

Run `npm run dev` rather than `next dev`. `exec/server.mjs` sits in front of Next.js and handles terminal WebSockets.

### 3. Connect a cluster

The dev server prints a single-use admin invitation link on first startup. Open it, accept the invitation, and then add your Trellis API URL and operator token under **Organization → Cluster**.

Don't run mutation tests against a live Trellis cluster or a shared database unless you're authorized to.

## Commands

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

For schema changes, see [Database migrations](docs/database-migrations.md).

## Before you open a pull request

- Run `npm run lint`, `npx tsc --noEmit`, and `npm test`. CI runs lint and tests on every pull request.
- Run `npm run build` if you changed routing, configuration, or anything else the build depends on.
- Add or update tests next to the code you changed.
- For visual changes, check desktop and mobile layouts in light and dark themes. The [visual verification guide](docs/design-system/workflow/visual-verification.md) explains how to capture every screen against seeded data.
