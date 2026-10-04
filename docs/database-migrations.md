# Database migrations

Bower uses [Drizzle](https://orm.drizzle.team/) for its PostgreSQL schema. The schema lives in [`src/db/schema.ts`](../src/db/schema.ts) and migrations live in [`drizzle/`](../drizzle).

## Automatic migrations

When `AUTO_MIGRATE=true`, Bower applies pending migrations on startup, before it starts serving traffic. Both the [`trellis.yml`](../trellis.yml) quick start and [`.env.example`](../.env.example) enable it.

Startup migrations retry transient failures up to ten times, two seconds apart, with a five-second connection timeout per attempt. Transient failures are DNS and connection errors and PostgreSQL-not-ready errors. Authentication, SQL, and other errors fail immediately. If the connection keeps failing after the last attempt, startup fails.

## Manual migrations

To control when migrations run, unset `AUTO_MIGRATE` and run `npm run db:migrate` before you start the new version. The command reads `DATABASE_URL` from the process environment:

```bash
# Local development (from the repository root)
npm run db:migrate

# Against a Trellis-deployed Postgres
DATABASE_URL="postgres://bower:bower@<node-ip>:5432/bower" npm run db:migrate
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
