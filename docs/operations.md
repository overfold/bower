# Bower operations: backup, restore, and upgrades

Use this runbook alongside [installation](installation.md), [configuration](configuration.md), [database migrations](database-migrations.md), and [managed ingress](managed-ingress.md). Commands below are operator procedures, **not permission to run them against a shared system**. Rehearse with disposable resources; schedule and authorize production maintenance separately.

## Supported operating contract

Run **one active Bower process**, with the web task group at `count: 1`, against one PostgreSQL database. Use stop/start replacement for Bower upgrades; do not overlap old and new allocations. Do not run a second installation managing the same Trellis cluster's ingress. An external highly available PostgreSQL service is recommended for production, but does not make Bower itself highly available.

`reconciliationRunning` in `src/lib/deployment-reconciler.ts`, the instrumentation timer guard, and ingress's promise queue are process-local. Every process starts background reconciliation. Manual deployment refresh also invokes project reconciliation outside the global guard. Trellis incarnation/version fences reject competing conditional applies, but do not atomically coordinate Bower's deployment rows, canary events, notifications, active-job updates, and cleanup. Shared authentication admission/password leases and compatible workload credentials are **not** a multi-replica support claim. There is no supported leader election or read-only replica mode. Avoid concurrent refreshes/deploy operations on the same service/environment, including automation, while a rollout is active.

The quick-start database and Caddy volumes are node-local and locality-bound. A restarted allocation on the same node can reuse data; loss of the node is disaster recovery, not transparent failover. Ingress uses `recreate` updates and can briefly interrupt traffic. There is no zero-downtime or general multi-replica Bower contract today.

## Recovery inventory and policy

Record a recovery-point objective (maximum acceptable data loss), recovery-time objective, backup frequency, retention, owner, encrypted off-node storage location, and last successful restore drill. Alert on overdue/failed backups and certificate expiry. A dump that has never been restored is not a validated backup.

Maintain this inventory together, with timestamps and checksums but **without secret values in tickets, Git, shell tracing, or logs**:

| State | Backup and restore requirement |
|---|---|
| PostgreSQL | All schemas, including `public` and Drizzle's migration journal in `drizzle`. Contains sessions, durable operator tokens, registry/webhook credentials and potentially sensitive historical audit rows. Encrypt and restrict dumps like credentials. |
| Bower action encryption key | Preserve `platform/encryption-key` / `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in a protected secret store. It encrypts Next.js action payloads, **not database rows**. Restoring a database alone does not restore it. |
| Route-auth signing secret | Preserve `platform/route-auth-secret` / `BOWER_ROUTE_AUTH_SECRET`. Changing it invalidates existing route-access grants; it is distinct from the action key. |
| Caddy automatic TLS state | Back up `/data` from the actual ingress node: certificates, private keys, and ACME account state. Also preserve `/config` (autosaved config); Bower regenerates desired routing from database state. |
| Custom TLS | Preserve original certificate chains and private keys securely outside Bower, plus their source namespace/name mapping. Trellis secret reads return metadata only; Bower cannot export the original PEM. Uploads mirror PEM secrets into the ingress namespace. |
| Trellis desired state and secrets | Use Trellis's administrator backup procedure and separately preserve its `secrets_key`, node identities/configuration, and local volume bytes. The Trellis secrets-encryption key is **not** either Bower key. |
| Deployment configuration | Save the edited manifest, pinned Bower/proxy/proxy-sync image tags or digests, PostgreSQL/Trellis versions, public URL, namespaces, DNS, trust roots, and protected runtime configuration. Maintain registry access to old images. |

Trellis's [backup contract](https://github.com/overfold/trellis/blob/main/docs/public/operations.md#backups) covers desired jobs, encrypted secrets, volume locality metadata, and network registrations, not local volume bytes or its encryption key. It requires an administrator signing key; Bower's injected `cluster/write` token cannot perform backup/restore. Restore requires a fresh empty cluster, matching network settings and backup format. Recover the owning node identity/data for bound volumes or deliberately use a new volume identity with prepared data; changing only `host_path` does not move a volume. Follow the installed Trellis release's procedure, not an assumed raw directory copy of control-plane state.

## Take a coordinated backup

1. Pause CI/webhooks and user mutations. Let active deployments settle; record any remaining deployment IDs and Trellis incarnation/version/revision. Stop the sole Bower process to quiesce background writes. Application workloads and ingress can continue serving, but freeze route/certificate and Trellis desired-state mutations for the recovery point.
2. Dump PostgreSQL using a client matching its server major version (the quick start uses PostgreSQL 16). Run from a trusted host that can reach the private database; do not publish port 5432 for backup. Use a protected `PGSERVICEFILE` and `PGPASSFILE` (mode `0600`) or your platform's secret injection. Do not put passwords in command arguments or enable `set -x`. Here `bower-source` is an operator-configured PostgreSQL service:

   ```bash
   umask 077
   BACKUP_DIR=/secure/backups/bower/RECOVERY_POINT
   mkdir -p "$BACKUP_DIR"
   pg_dump --dbname='service=bower-source' --format=custom \
     --file="$BACKUP_DIR/bower.dump"
   pg_restore --list "$BACKUP_DIR/bower.dump" > "$BACKUP_DIR/bower.contents"
   sha256sum "$BACKUP_DIR/bower.dump" > "$BACKUP_DIR/bower.dump.sha256"
   ```

   Do not use `--schema=public`: that omits the migration journal. This logical dump is transactionally consistent for PostgreSQL, not for Trellis or Caddy. Do not tar a running PostgreSQL data directory. Use database-native base backup/WAL procedures if point-in-time recovery is required; this runbook's logical dump does not provide PITR. `pg_dump` does not save cluster roles; provision the target owner separately or securely preserve required role definitions. Do not restore unrelated cluster-wide roles blindly.
3. Snapshot ingress storage consistently. Stop the ingress job for a cold archive (maintenance interruption), or use a supported filesystem snapshot that captures both directories at one point. Resolve the real paths from the ingress namespace, node configuration, and volume mounts, not container staging paths. With default Trellis `data_dir`, the backing directories are `/var/lib/trellis/data/volumes/namespaces/platform/bower-ingress-data` and `bower-ingress-config`. Adjust for nondefault configuration. Example on the owning node, **after Caddy is stopped**:

   ```bash
   # Set INGRESS_VOLUME_ROOT to the verified namespace volume directory.
   sudo tar --acls --xattrs --numeric-owner -C "$INGRESS_VOLUME_ROOT" \
     -cpf "$BACKUP_DIR/ingress.tar" bower-ingress-data bower-ingress-config
   sudo chmod 600 "$BACKUP_DIR/ingress.tar"
   sudo sha256sum "$BACKUP_DIR/ingress.tar" > "$BACKUP_DIR/ingress.tar.sha256"
   ```

   Keep certificate/key file permissions and ownership. Verify that the archive contains `/data`'s certificate and ACME account directories without printing their contents. Archives and checksums must be transferred to encrypted off-node storage; leaving them on the ingress/database node does not protect against node loss.
4. Capture Trellis desired state through its supported administrator backup, protect the separate keys and custom PEM originals, and record the matching recovery point. Restart ingress, then Bower, resume producers, and verify connectivity and route readiness. Do not leave maintenance mode without checking the backup commands' exit status and off-node transfer.

## Restore rehearsal and disaster recovery

1. Verify checksums and access to all required keys/images before starting. In a drill, use an isolated network, a disposable database and fake/disposable Trellis endpoint. Never start restored Bower with production cluster credentials or production public DNS: instrumentation immediately reconciles jobs, resumes rollouts and may roll back workloads. Block notifications, webhook producers, and ACME production issuance in a drill. Use staging ACME or test certificates where applicable.
2. Keep Bower stopped. Create a **new empty target database** with an appropriate owner. Match PostgreSQL major version initially. Configure `bower-restore` as a protected PostgreSQL service pointing only to that target, then restore:

   ```bash
   # Confirm the target service/database is disposable or authorized before this write.
   pg_restore --dbname='service=bower-restore' --no-owner --no-privileges \
     --exit-on-error --single-transaction "$BACKUP_DIR/bower.dump"
   psql --dbname='service=bower-restore' --no-psqlrc --set=ON_ERROR_STOP=1 \
     --command='SELECT count(*) FROM drizzle.__drizzle_migrations;'
   ```

   Connect as the intended Bower database owner, or provision grants separately. Do not use `--clean` on an existing database. Compare non-secret fixture counts, migration journal and application configuration against the recovery point. Restored sessions/API keys may still be valid; restrict access until incident-related credential/session remediation is decided.
3. Restore the protected Bower keys/configuration. For same-cluster recovery, do not overwrite newer Trellis state blindly. Compare actual jobs and the restored deployments' accepted identities; stale database state can trigger automatic rollback after elapsed deadlines. For full cluster loss, first follow Trellis's fresh-cluster restore procedure, restoring encrypted secrets with their original Trellis key and recovering locality-bound storage before scheduling workloads. Durable operator credentials must be re-provisioned as needed; workload tokens are freshly injected, never replayed from backups.
4. With ingress stopped, restore its archive into the verified namespace volume root, preserving ownership/modes. Do not extract untrusted archives or overwrite live certificate state. Prepare the new backing data before changing a volume identity. Retain missing custom TLS cert/key originals for re-upload through Bower after startup; the database's secret metadata is insufficient. If `/data` is lost, expect ACME reissuance, a possible HTTPS outage, and rate limits; restoring `/config` alone cannot recover certificates. If archives were relocated, resolve checksum paths to the downloaded files before checking.

   ```bash
   # Verify the archive checksum and the target path before extracting.
   sudo sha256sum --check "$BACKUP_DIR/ingress.tar.sha256"
   sudo tar --acls --xattrs --numeric-owner -C "$INGRESS_VOLUME_ROOT" \
     -xpf "$BACKUP_DIR/ingress.tar"
   ```

5. After checking identity alignment with Bower stopped, start the **same Bower release** with `AUTO_MIGRATE` unset/false. Reconciliation begins immediately; there is no pause switch. Re-upload any missing custom TLS originals through Bower to populate source and ingress copies. Confirm login, project/environment/route metadata, deployment history, live Trellis reads and accepted job identity. Check ingress allocations/tasks are healthy, actual HTTP/HTTPS routes respond, the expected certificate chain/expiry is served, protected routes deny unauthenticated requests and allow authorized ones, and ACME account/certificate state remains present across an ingress replacement. Test an isolated deployment and recovery from a failed rollout only against disposable resources.
6. Record dump/restore duration, recovery point, counts, route/certificate results, failures, and measured RPO/RTO. Clean up the drill database/cluster/storage only after confirming those resources are disposable. A PostgreSQL restore pass alone does not validate TLS continuity or a full Trellis disaster recovery.

## Upgrade and rollback

1. Read release notes, changed migrations and security guidance. Pin **matching Bower, Caddy and proxy-sync releases**; retain the old images. Check any older per-environment proxy transition and TLS-volume migration in [configuration](configuration.md#custom-tls-and-upgrading-existing-installations) and [managed ingress](managed-ingress.md#tls). Back up old Caddy `/data` before the first persistent-volume allocation replaces it; a newly mounted volume does not import old container files.
2. Rehearse the upgrade on a restored disposable database. Run the target release's migration entry point twice (second run should be a no-op), then verify the same representative data and application behavior. Obtain a coordinated pre-upgrade backup and maintenance approval before production changes.
3. Pause producers, settle deployments, stop Bower, and use `recreate` replacement (no overlapping processes). Do not accidentally remove the bundled Postgres group or recreate its volume. Preserve both Bower keys; do not rerun initial secret generation on each release. When building your own images, supply the valid action key securely for build/runtime as described by Next.js, never as a committed Dockerfile value.
4. Apply migrations once under operator control with Bower stopped. Repository execution is `npm run db:migrate` with `DATABASE_URL` securely supplied in the **process environment**; `.env.local` is not automatically loaded by this command. In the published container the entry point is `node exec/migrate.mjs` from `/app` (do not assume npm scripts are packaged). Alternatively keep quick-start `AUTO_MIGRATE=true` and let the sole new process migrate before serving. Do not run old Bower against a partially upgraded schema. Transient connection failures retry indefinitely with bounded backoff; authentication/SQL failures terminate. Monitor and stop an incorrectly configured attempt rather than waiting forever.
5. Start the target release, verify migration completion, connectivity, login, reconciliation, ingress/TLS and protected routes, then resume producers. Save a fresh backup after a successful upgrade and record image digests/journal state.
6. If verification fails, stop the new process and keep producers paused. Bower has **no automatic down-migrations**. Reusing the old image is safe only when its compatibility with the migrated schema has been established. Otherwise restore the pre-upgrade dump into a new database, restore matching configuration/keys and any changed ingress state, and run the previous pinned images. Reconcile Trellis changes made since the backup deliberately; database restore does not undo cluster applies, certificate rotations or external effects. Account for post-backup data loss before switching traffic.

## Credential remediation required for older versions

Earlier versions returned durable organization Trellis tokens to browsers. Treat previously stored tokens as potentially disclosed **even after upgrading**. The new UI's blank replacement field keeps the old token; an upgrade is not revocation. Before opening traffic after a restore, ensure a backup cannot silently reintroduce an exposed token.

An authorized Trellis administrator must inventory affected organizations, issue a replacement `cluster/write` credential through Trellis's administrator-only credential workflow, store it securely, replace the durable token in each affected organization's connection settings (and any bootstrap secret/configuration still holding it), verify reads and a controlled write, and revoke the old credential ID. If active compromise is suspected, revoke first and accept the connectivity interruption. Update other legitimate consumers before revocation where safe. Do not log or paste the minted token into incident records. Verify the old credential is denied and the new one works. See [authentication security](authentication-security.md#operator-remediation) and Trellis's [credential operations](https://github.com/overfold/trellis/blob/main/docs/public/operations.md).

Do not copy allocation-injected `TRELLIS_TOKEN` into durable settings. Native `api_access` tokens are replaced/revoked with allocation generations; ordinary credential-list/revoke operations are not their rotation mechanism. Protect/review access to old database dumps, audit exports and logs, which may retain historical credentials. Purging retained data or rotating external credentials requires a separately authorized operation; this repository change performs neither.

## Failure signals and response

| Signal | Meaning and operator response |
|---|---|
| Bower HTTP task health succeeds | Front server responds; **not** proof of Trellis reachability, background reconciliation, PostgreSQL recovery correctness or TLS continuity. Check each separately. |
| Dashboard “Trellis is unavailable” / read error | Failed reads show safe errors with Retry and connection-settings guidance, not a healthy empty cluster. Ordinary non-streaming GET requests time out after 10 seconds, including response-body reads; streams retain caller cancellation. Check network/DNS, CA trust and credential expiry/revocation. No write retries are added; write/plan completion may still block. |
| Node heartbeat `stale` / `unknown` | Node detail marks observations older than 60 seconds stale; absent/invalid timestamps are unknown. This is node heartbeat freshness, **not** a persisted last-successful Bower connectivity probe. Refresh to obtain a new observation; don't infer healthy connectivity from an old screenshot or stored deployment status. |
| Deployment `reconciliation_error` event | A safe diagnostic is recorded once per deployment/type, including credential-resolution failures. It is historical, not a current health gauge. Inspect live Trellis job/allocations and Bower logs; recovery can later advance that same deployment. Deadlines continue to elapse during outages. A 404 or conditional-apply 409 fails the deployment rather than overwriting an external deletion/change. |
| `Bower deployment reconciliation failed` log | A project-level failure (including inability to write diagnostics) is no longer silently swallowed by `Promise.allSettled`; other projects continue. Logs include organization/project IDs and safe error categories, not upstream response bodies. Inspect database availability and live cluster state. |
| `Bower shared ingress reconciliation failed` / `Bower reconciliation failed` log | Desired ingress update or background pass failed; retry is periodic. Correlate organization ID and inspect route validation, hostname overlap, missing TLS mirrors, database, network and credentials using protected operator access. Safe summaries intentionally omit raw error bodies. No persisted background-loop health endpoint exists. |
| Ingress route-sync unhealthy | Discovery or Caddy load has not completed recently. Sync refreshes its health file only after all namespace discovery and Caddy acceptance succeed; the default 15-second freshness threshold plus Trellis polling/threshold determines when unhealthy appears. Last accepted config is retained, not a partial config. It may contain stale upstreams; inspect both Caddy and route-sync task health/logs, not just a TCP listener. |

Alert externally on reconciliation failure logs, prolonged in-progress deployments, unhealthy ingress, stale node heartbeats and synthetic HTTPS/protected-route checks. Bower does not yet provide a durable last-success timestamp or comprehensive operational readiness endpoint; do not equate a quiet log, admitted job, or stored `pending`/`healthy` row with freshly observed readiness.

## Local validation record (2026-10-05)

A disposable PostgreSQL 15 cluster was created with `pg_virtualenv` and removed after the drill. A database with the first 24 journal entries and a non-secret organization/project fixture was dumped in custom format and restored with the flags above. The project value and all 24 journal entries survived; `npm run db:migrate` advanced the restored journal to 25 entries (`0025_auth_abuse`), and a second run left it at 25 with the fixture unchanged. No shared database was used.

A cold tar/extract rehearsal preserved disposable self-signed certificate/key bytes, mode `0600` on the key, and fixture ACME-account/config files. The documented base64 action-key generation imported successfully as AES-GCM; the legacy hex generation decoded to 48 bytes and failed AES import. Reconciliation regression tests cover missing credentials, safe/deduplicated upstream failures, resumed reads without false health, and logging/recovery after project-query failure. A local HTTP server verifies ordinary read cancellation before headers and during body consumption, then successful recovery.

These checks do **not** establish PostgreSQL 16/provider-specific recovery, a real Caddy ACME renewal/restore, Trellis control-plane disaster recovery, node-loss recovery, or multi-replica safety. Real-Trellis lifecycle/HTTPS acceptance is a separate suite; operators must still rehearse the entire runbook on their disposable topology and record measured RPO/RTO before relying on it in production.
