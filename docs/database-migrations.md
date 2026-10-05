# Database migrations

Bower uses [Drizzle](https://orm.drizzle.team/) for its PostgreSQL schema. The schema lives in [`src/db/schema.ts`](../src/db/schema.ts) and migrations live in [`drizzle/`](../drizzle).

## Automatic migrations

When `AUTO_MIGRATE=true`, Bower applies pending migrations on startup, before it launches Next.js or the front server. Both the [`trellis.yml`](../trellis.yml) quick start and [`.env.example`](../.env.example) enable it.

If the database isn't reachable yet, Bower waits for it:

- **Transient failures retry until the database is available.** These are DNS and connection errors and PostgreSQL-not-ready errors. Retries back off exponentially from two seconds up to 30 seconds, with a five-second connection timeout per attempt.
- **Other failures stop startup immediately.** Authentication, SQL, and other errors exit with a nonzero status.
- **While waiting, Bower reports not ready.** It logs each retry without the connection string, and stops normally on SIGTERM or SIGINT. A persistent DNS or configuration problem shows up as an unhealthy task with retry logs, not a restart loop.

## Manual migrations

To control when migrations run, unset `AUTO_MIGRATE`, stop Bower, and run the target version's `npm run db:migrate` before you start it. The command reads `DATABASE_URL` from the process environment, not `.env.local`. In the published container, use `node exec/migrate.mjs` from `/app`; npm scripts are not guaranteed to be packaged. Follow the [upgrade and rollback runbook](operations.md#upgrade-and-rollback); migrations have no automatic down-migration path.

```bash
# Local development (from the repository root)
npm run db:migrate

# Supply DATABASE_URL through protected environment injection on a trusted
# host/container that can reach the private database. Do not publish port 5432.
npm run db:migrate
```

## Changing the schema

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review the generated SQL before applying it.
4. Commit the SQL, snapshot, and journal together.

Running `npm run db:generate` on an unchanged schema reports "No schema changes, nothing to migrate".

## Snapshot history

`drizzle/meta/0023_snapshot.json` is a consolidated baseline for the schema after `0024_notification_read_states`. It covers the handwritten migrations after `0005`, so their intermediate snapshots are intentionally absent.

- Snapshot filenames use journal indices, not SQL filename prefixes. The SQL numbering skips `0007`.
- The baseline was checked against a fresh database built from the existing SQL migrations, including column defaults, enums, indexes, and constraint names and definitions. Existing migration SQL and journal timestamps were preserved.
- Custom SQL functions and triggers belong to the handwritten migrations, not to Drizzle snapshots.
