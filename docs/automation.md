# CI/CD automation

## Application automation v1

Bower owns application-level automation; Trellis remains the infrastructure API for scheduling, placement and container lifecycle. CLI and MCP clients should use Bower's application contracts, not turn project/service names into cluster-wide Trellis calls.

This delivery provides read-only diagnosis, deploy, restart and explicit-target rollback through HTTP, a CLI and a stdio MCP server, with credential management in Account settings. Historical metrics, log streaming, catalog pagination and idempotent writes remain outside this delivery. No generic infrastructure proxy or command execution endpoint is provided.

### Scoped credentials

In **Settings → Account → API keys**, choose **New key**, select a project/environment, permissions and lifetime (1 hour, 1 day, 7 days or 30 days). Read-only is the default. Write permissions are unavailable for viewers and remain checked server-side. The key is shown once; save it securely before closing. The table shows access bounds, permissions and expiration, including expired and legacy keys. Revoke ends access immediately. Project choices belong to the currently selected organization; existing keys remain visible across your organizations.

For browser integrations, set `BOWER_PUBLIC_URL` to the browser-facing origin (not Next's internal listener). While signed in to Bower, create a credential with a same-origin session request to `POST /api/v1/credentials`. For example, in the browser console on your Bower instance:

```js
const response = await fetch('/api/v1/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Production diagnosis',
    projectId: '<project-uuid>',
    environmentId: '<environment-uuid>',
    scopes: ['read'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }),
})
const credential = await response.json()
// Save credential.token securely; it is returned only at creation.
```

A successful response is `201 { token, id, expiresAt }`. Every new automation credential is bound to one project and one environment and expires within 30 days. Independent scopes are `read`, `deploy`, `restart` and `rollback`; request only those needed. Viewers may create read credentials; writes require a current project deployer/admin role. A credential cannot grant more access than its creator currently has. Membership and direct/team project grants are checked on every operation; explicit organization membership takes precedence over instance-admin fallback, matching the dashboard.

Credential issuance/revocation require a valid browser session and a matching `Origin`; bearer credentials cannot mint or revoke credentials. `DELETE /api/v1/credentials?id=<credential-uuid>` revokes a credential owned by the signed-in user (204, including when already absent). Creation and revocation use the existing audit trail. Tokens are stored only as SHA-256 hashes. New keys created through the older key action also expire after 30 days. Existing keys retain their deploy-only access and original lifetime; they do **not** gain diagnosis or recovery access. Rotate those legacy keys to scoped credentials rather than continuing to use organization-wide, non-expiring credentials.

### Read-only diagnosis

Send `Authorization: Bearer <token>` to `GET /api/v1/automation`:

| `operation` | Required query parameters | Response |
|---|---|---|
| `projects` | none | `{ projects: [{ id, name, slug }] }` |
| `environments` | `projectId` | `{ environments: [{ id, projectId, name, slug }] }` |
| `services` | `projectId` | `{ services: [{ id, projectId, name, slug }] }` |
| `deployments` | `serviceId`, `environmentId` | `{ deployments: [{ id, serviceId, environmentId, image, status, strategy, trigger, startedAt, completedAt }] }` |
| `allocations` | `serviceId`, `environmentId` | `{ allocations: [{ id, phase, health, tasks, createdAt, lastTransitionAt }] }` |
| `logs` | `serviceId`, `environmentId`, `allocationId`; optional `task` | `{ logs: string }` (last 200 lines) |
| `metrics` | `serviceId`, `environmentId`, `allocationId` | `{ metrics: [{ allocationId, task, cpuUsageNanoseconds, memoryUsageBytes, collectedAt }] }` |

```bash
curl 'https://bower.example.com/api/v1/automation?operation=projects' \
  -H "Authorization: Bearer $BOWER_TOKEN"
```

Catalogs return at most 100 entries; deployment history returns the latest 20 records in that service/environment. Catalogs expose only the authorized project/environment, though services are project-level identities. IDs are Bower UUIDs except allocation IDs, which are opaque. Timestamps are ISO 8601 strings; `completedAt` may be null. Empty collections are successful responses, not errors.

Deployment history is Bower's recorded state, not a reconciliation request. Allocation health, bounded log tails and current metrics come from Trellis after Bower resolves and checks service/environment/allocation ownership. Metrics expose cumulative CPU nanoseconds and current memory bytes, not a computed CPU rate. Reads do not deploy, reconcile or write audit entries, matching dashboard read behavior; successful authorization updates the credential's last-use timestamp.

Responses omit environment values, secret bindings, stored JobSpecs/plans, cluster connection credentials, node addresses and arbitrary allocation labels. Application logs may themselves contain sensitive content: treat read credentials accordingly. Responses use `Cache-Control: no-store`; upstream error bodies and connection details are not exposed.

### Deploy contract

`POST /api/v1/automation` accepts the same JSON as `/api/deploy` below. Both routes call the shared `deployApplication` contract and existing deployment executor, preserving planning, strategy behavior and API-key/user audit attribution. Success is `202 { accepted: true, deploymentId }`: Trellis accepted the apply, not that rollout is healthy. Read deployment history and allocations to diagnose progress. Writes are not idempotent; do not blindly retry after a lost response.

### Recovery contracts

`PATCH /api/v1/automation` requires `serviceId`, `environmentId` and `operation`:

| `operation` | Required scope | Additional input | Accepted response (202) |
|---|---|---|---|
| `restart` | `restart` | none | `{ accepted: true, operation: "restart" }` |
| `rollback` | `rollback` | `targetDeploymentId` (Bower UUID) | `{ accepted: true, operation: "rollback", deploymentId }` |

```bash
curl -X PATCH https://bower.example.com/api/v1/automation \
  -H "Authorization: Bearer $BOWER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"operation":"rollback","serviceId":"<service-uuid>","environmentId":"<environment-uuid>","targetDeploymentId":"<deployment-uuid>"}'
```

Restart resolves the service's active job in the authorized environment; callers cannot supply a namespace or Trellis job name. Rollback requires an explicit healthy release in that same service/environment, older than the currently running release. It replays the stored JobSpec with its recorded image pins through the existing conditional plan/apply flow. Running releases, newer releases, unknown running identities and targets without stored pins are rejected (400). No implicit "previous release" fallback is exposed through automation.

Both operations use the dashboard's existing recovery executor and audit actions, attributed to the API key and its user. Acceptance is not proof of healthy completion. Restart does not create a deployment record; inspect allocations/logs for progress. Rollback creates a deployment record. These writes are not idempotent; diagnose before retrying an uncertain response. `/api/deploy` remains POST-only and does not expose recovery.

### Errors and shared entry points

Errors are JSON `{ error: string }`: 400 invalid input, 401 missing/invalid/expired/revoked credential, 403 insufficient scope or resource access, 404 missing service configuration/allocation, and 502 backend failure. JSON writes are limited to 8 KiB with a five-second body-read deadline (413/408 on overflow/timeout). `/api/deploy` now uses the same error handling, including 403 for valid credentials denied resource access instead of its old 401/404 responses.

The shared TypeScript entry points and input/result types live in `src/lib/automation.ts`: `readApplication`, `deployApplication` and `recoverApplication` authenticate internally and derive the audit actor, so in-process adapters must not supply identities or bypass authorization. The CLI and MCP adapters share an operation inventory and HTTP client in `scripts/automation/client.mjs`. They do not import database/server modules, hold Trellis credentials or replace Bower authorization/auditing.

### CLI

Use Node.js 22 and run `npm ci` in a checkout of Bower. No global package installation or publication is required. Set `BOWER_URL` to the Bower **origin** and inject `BOWER_TOKEN` from your secret manager/environment. The client requires HTTPS except for loopback development, refuses redirects, times out requests after 30 seconds and never retries them. It does not read `.env.local`, store tokens on disk or accept tokens in command-line arguments.

```bash
export BOWER_URL=https://bower.example.com
# Inject BOWER_TOKEN securely; do not commit it or paste it into shell history.
npm run --silent bower -- projects
npm run --silent bower -- environments --project-id <project-uuid>
npm run --silent bower -- services --project-id <project-uuid>
npm run --silent bower -- deployments --service-id <service-uuid> --environment-id <environment-uuid>
npm run --silent bower -- allocations --service-id <service-uuid> --environment-id <environment-uuid>
npm run --silent bower -- logs --service-id <service-uuid> --environment-id <environment-uuid> --allocation-id <allocation-id> --task app
npm run --silent bower -- metrics --service-id <service-uuid> --environment-id <environment-uuid> --allocation-id <allocation-id>
npm run --silent bower -- deploy --service-id <service-uuid> --environment-id <environment-uuid> --image ghcr.io/org/app:v2 --confirm
npm run --silent bower -- restart --service-id <service-uuid> --environment-id <environment-uuid> --confirm
npm run --silent bower -- rollback --service-id <service-uuid> --environment-id <environment-uuid> --target-deployment-id <deployment-uuid> --confirm
```

Use `node scripts/automation/cli.mjs --help` for usage, or invoke that script directly from automation. Success prints JSON to stdout; failures print a message to stderr and exit 1. Use `--silent` with npm to avoid its lifecycle banner in machine-readable output. Unknown options, inappropriate fields and writes without `--confirm` fail before any request. Creation/revocation of credentials stays in the authenticated browser UI/API rather than allowing bearer keys to mint keys.

### MCP

Launch `node /absolute/path/bower/scripts/automation/mcp.mjs` as a local stdio MCP server, with `BOWER_URL` and `BOWER_TOKEN` injected into its environment. Example host configuration (adapt the path and your host's secret injection mechanism):

```json
{
  "mcpServers": {
    "bower": {
      "command": "node",
      "args": ["/absolute/path/bower/scripts/automation/mcp.mjs"],
      "env": {
        "BOWER_URL": "https://bower.example.com",
        "BOWER_ALLOW_WRITES": "0"
      }
    }
  }
}
```

The seven read tools are `bower_projects`, `bower_environments`, `bower_services`, `bower_deployments`, `bower_allocations`, `bower_logs` and `bower_metrics`. Arguments use the HTTP contracts' camelCase names. Results provide JSON text and structured content; Bower denials return MCP tool errors. Only MCP protocol messages go to stdout. Do not launch via plain `npm run mcp`, whose banner would corrupt stdio; use the direct Node command or `npm run --silent mcp`.

Set **`BOWER_ALLOW_WRITES=1`** to additionally expose `bower_deploy`, `bower_restart` and `bower_rollback`. Each requires `confirm: true` and its independent API-key scope; rollback also requires `targetDeploymentId`. Tools carry read-only/destructive/idempotency annotations. These annotations and confirmation arguments are intent guards, **not proof of human approval or authorization**: configure your MCP host's approval policy, use narrowly scoped keys and retain Bower's server-side checks. No credential-management, infrastructure, shell or generic HTTP tools are exposed.

## Deploy API

Trigger a deployment from any CI system using a scoped credential with `deploy` permission (or an existing deploy API key).

```bash
curl -X POST https://bower.example.com/api/deploy \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "<service-id>",
    "environmentId": "<environment-id>",
    "image": "ghcr.io/org/app:v1.2.3"
  }'
```

`serviceId` and `environmentId` are UUIDs visible in the Bower UI under each service and environment.

## Registry webhooks

Create an inbound endpoint under **Project → Integrations**. The endpoint token doubles as the HMAC-SHA256 signing secret.

Bower accepts the signature in either of these headers:

- `X-Bower-Signature`
- `X-Hub-Signature-256` (GitHub-compatible format)

Supported payload formats: Docker Hub, GHCR, and generic (any POST body containing an `image` field).

### Filtering

Each endpoint can be configured to deploy on:

- Any push to the linked repository
- Only tags matching a regex (e.g. `^v\d+\.\d+\.\d+$`)
- Only a specific image digest

### Outbound notifications

Configure outbound webhooks under **Project → Notification channels** to receive deployment events. Supported targets: Slack, Discord, and generic HTTP. The payload includes service, environment, image, status, triggered-by, and timestamp.
