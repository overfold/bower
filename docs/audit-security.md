# Audit access and sensitive data

Organization-wide audit history is available only to organization owners and admins (including instance access granted by the existing organization policy). The audit query verifies the current session and requested organization itself; both `/audit` and Home activity use this query. Organization members receive no organization-wide audit rows. Project/service/environment metadata for authorized audit readers remains available, including name resolution for older entries.

Route and base-service configuration changes use explicit audit representations instead of complete database rows. They retain routing/resource settings and configured header/variable names, but omit password hashes, header values, environment-variable values, redirect destinations, and health-check commands. The shared audit writer also recursively redacts credential fields and configuration value maps.

## Historical entries

The same redaction runs before audit results reach client props, and historical route/base-config snapshots are converted to the current safe representations. Unchanged fields are redacted too; this is not merely a UI diff filter. Deploying the application activates this protection without a database migration or writes to existing rows.

Historical raw values still exist in the database and its backups. This read-side remediation does not purge them, revoke credentials, or undo prior exposure. Operators should review access to prior audit exports/backups and rotate potentially exposed credentials. Any permanent purge of stored audit details or backups requires a separately reviewed, authorized data-remediation operation; none is performed by this fix.
