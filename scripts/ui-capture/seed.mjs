import postgres from "postgres";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";

// Refuse accidental use against a persistent database. This database is disposable.
const url = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("_ui_audit")
) {
  throw new Error(
    "UI audit requires a local disposable database whose name ends in _ui_audit.",
  );
}
const sql = postgres(url.toString());
const passwordHash = await hash("Audit-only-2026!", 12);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const output = process.env.UI_AUDIT_OUTPUT || "ui-audit-output";
try {
  const fixture = await sql.begin(async (sql) => {
    await sql`TRUNCATE users, organizations CASCADE`;
    const [owner, admin, viewer] = await sql`INSERT INTO users ${sql([
      {
        name: "Alex Morgan",
        email: "alex@example.test",
        password_hash: passwordHash,
        is_instance_admin: true,
      },
      {
        name: "Sam Rivera",
        email: "sam@example.test",
        password_hash: passwordHash,
        is_instance_admin: true,
      },
      {
        name: "Jamie Chen",
        email: "jamie@example.test",
        password_hash: passwordHash,
        is_instance_admin: false,
      },
      {
        name: "Taylor Wilson",
        email: "taylor.wilson.with.a.long.address@example.test",
        password_hash: passwordHash,
        is_instance_admin: false,
      },
    ])} RETURNING *`;
    const [org] =
      await sql`INSERT INTO organizations (name,slug,trellis_api_url,trellis_api_token) VALUES ('Acme Cloud','acme-cloud','http://127.0.0.1:8128','audit-fake-token') RETURNING *`;
    for (const [user, role] of [
      [owner, "owner"],
      [admin, "admin"],
      [viewer, "member"],
    ]) {
      await sql`INSERT INTO organization_members (org_id,user_id,role) VALUES (${org.id},${user.id},${role})`;
    }
    // Larger organizations expose the optional member filters.
    for (let i = 1; i <= 9; i++) {
      const [member] = await sql`INSERT INTO users (name,email,password_hash) VALUES (${`Audit Member ${i}`},${`member${i}@example.test`},${passwordHash}) RETURNING id`;
      await sql`INSERT INTO organization_members (org_id,user_id,role) VALUES (${org.id},${member.id},'member')`;
    }
    const [team] =
      await sql`INSERT INTO teams (org_id,name) VALUES (${org.id},'Platform Engineering') RETURNING *`;
    for (const user of [owner, admin])
      await sql`INSERT INTO team_memberships (team_id,user_id) VALUES (${team.id},${user.id})`;
    const [project] =
      await sql`INSERT INTO projects (org_id,name,slug,description,owning_team_id) VALUES (${org.id},'Commerce Platform','commerce','Storefront, checkout API, and asynchronous order processing.',${team.id}) RETURNING *`;
    const [emptyProject] =
      await sql`INSERT INTO projects (org_id,name,slug) VALUES (${org.id},'Internal Tools','internal-tools') RETURNING *`;
    await sql`INSERT INTO environments (project_id,name,slug,trellis_namespace) VALUES (${emptyProject.id},'Production','production','internal-tools-production')`;
    // The project filter is shown only when there are more than eight projects.
    for (let i = 1; i <= 7; i++) {
      const slug = `audit-project-${i}`;
      const [extra] = await sql`INSERT INTO projects (org_id,name,slug) VALUES (${org.id},${`Audit Project ${i}`},${slug}) RETURNING id`;
      await sql`INSERT INTO environments (project_id,name,slug,trellis_namespace) VALUES (${extra.id},'Production','production',${`${slug}-production`})`;
    }
    await sql`INSERT INTO team_project_access (team_id,project_id,role) VALUES (${team.id},${project.id},'admin')`;
    await sql`INSERT INTO project_user_access (project_id,user_id,role) VALUES (${project.id},${viewer.id},'viewer')`;
    const [environment] =
      await sql`INSERT INTO environments (project_id,name,slug,trellis_namespace,env_vars) VALUES (${project.id},'Production','production','commerce-production',${sql.json({ NODE_ENV: "production", LOG_LEVEL: "info", REGION: "eu-west-1" })}) RETURNING *`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token,verified_at) VALUES (${org.id},'acme.test','audit-verified',now())`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token) VALUES (${org.id},'acme-preview.test','audit-pending')`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token) VALUES (${org.id},'acme-staging.test','audit-staging')`;
    await sql`INSERT INTO project_volumes (project_id,environment_id,name,host_path) VALUES (${project.id},${environment.id},'uploads','@/commerce-uploads')`;
    await sql`INSERT INTO project_volumes (project_id,environment_id,name,host_path) VALUES (${project.id},${environment.id},'cache','@/commerce-cache')`;
    let deploymentId, failedDeploymentId, rollbackDeploymentId, rolledBackDeploymentId, storefrontId;
    for (const [i, slug] of [
      "storefront",
      "checkout-api",
      "order-worker",
      "search-indexer",
    ].entries()) {
      const name = ["Storefront", "Checkout API", "Order Worker", "Search Indexer"][i];
      const [service] =
        await sql`INSERT INTO services (project_id,name,slug) VALUES (${project.id},${name},${slug}) RETURNING *`;
      if (i === 0) storefrontId = service.id;
      const config = {
        service_id: service.id,
        image: `ghcr.io/acme/${slug}:v2.4.1`,
        replicas: i === 0 ? 2 : 1,
        cpu: 500,
        memory: 536870912,
        resource_tier: "medium",
        deployment_strategy: i === 1 ? "canary" : "rolling",
        health_check_type: "http",
        health_check_path: "/healthz",
        health_check_port: 3000,
        env_vars: sql.json({ PORT: "3000", LOG_FORMAT: "json" }),
        volumes: sql.json(
          i === 0
            ? [
                {
                  name: "uploads",
                  container_path: "/app/uploads",
                  read_only: false,
                },
              ]
            : [],
        ),
      };
      await sql`INSERT INTO base_service_configs ${sql(config)}`;
      await sql`INSERT INTO service_configs ${sql({ ...config, project_id: project.id, environment_id: environment.id, active_job_name: slug })}`;
      // Search Indexer exists to show an unplaceable allocation, so it keeps a single release.
      for (const [j, status] of (i === 3 ? ["healthy"] : [
        "healthy",
        "failed",
        "rolled_back",
      ]).entries()) {
        const previous = {
          name: slug,
          namespace: "commerce-production",
          task_groups: [
            {
              name: "web",
              count: 2,
              tasks: [{ name: "app", image: `ghcr.io/acme/${slug}:v2.3.0` }],
            },
          ],
        };
        // The latest release rolled out 45 minutes ago, so every history range shows a deploy marker just before the CPU spike.
        const startedAt = new Date(Date.now() - (j === 0 ? 45 * 60000 : (j + 1) * 3600000));
        const completedAt = new Date(startedAt.getTime() + 90000);
        const [deployment] =
          await sql`INSERT INTO deployments ${sql({ service_id: service.id, environment_id: environment.id, image_before: `ghcr.io/acme/${slug}:v2.3.0`, image_after: config.image, strategy: config.deployment_strategy, status, trigger_type: j === 0 ? "webhook" : "manual", triggered_by_user_id: owner.id, trellis_job_name: slug, trellis_version: 3 - j, trellis_revision: 3 - j, job_spec: sql.json({ ...previous, task_groups: [{ ...previous.task_groups[0], tasks: [{ name: "app", image: config.image }] }] }), previous_job_spec: sql.json(previous), started_at: startedAt, completed_at: completedAt, created_at: startedAt })} RETURNING *`;
        // Event types match what Bower records, and each falls inside the deployment's own window
        // (started to completed). Failure events name the allocation involved.
        const at = (seconds) => new Date(startedAt.getTime() + seconds * 1000);
        const failingAllocation = { id: `${slug}-alloc-1`, phase: "failed", health: "unhealthy" };
        const events = [
          ["planning", "Generated Trellis JobSpec and requested a semantic plan.", 1, { revision: 3 - j }],
          ...(status === "healthy"
            ? [["healthy", "All allocations passed health checks", 90, { revision: 3 - j }]]
            : status === "failed"
              ? [["failed", "Health check failed: /healthz returned 503", 90, { allocations: [failingAllocation] }]]
              : [
                  ["scheduling_blocked", "Trellis could not schedule the new allocation.", 45, { allocations: [{ id: `${slug}-alloc-gone`, phase: "pending", reason: "insufficient_cpu", message: "No node has 500m CPU free" }] }],
                  ["auto_rollback", "Deployment deadline elapsed; Trellis accepted the previous known-good JobSpec.", 90, { convergence: { active: [{ id: `${slug}-alloc-gone`, phase: "pending" }] } }],
                ]),
        ];
        for (const [type, message, seconds, details] of events)
          await sql`INSERT INTO deployment_events (deployment_id,type,message,details,created_at) VALUES (${deployment.id},${type},${message},${sql.json(details)},${at(seconds)})`;
        if (i === 0 && j === 0) deploymentId = deployment.id;
        if (i === 0 && j === 1) failedDeploymentId = deployment.id;
        if (i === 0 && j === 2) rolledBackDeploymentId = deployment.id;
      }
      // More than one page of history, without altering the latest release.
      for (let j = 0; j < (i === 3 ? 0 : 6); j++) {
        const retained = j === 1;
        const image = `ghcr.io/acme/${slug}:${retained ? 'v2.3.0' : `v2.2.${j}`}`;
        const [older] = await sql`INSERT INTO deployments ${sql({
          service_id: service.id, environment_id: environment.id, image_after: image,
          strategy: "rolling", status: j === 0 ? "failed" : "healthy", trigger_type: "manual",
          trellis_job_name: retained ? slug : null, trellis_version: retained ? 2 : null, trellis_revision: retained ? 2 : null,
          job_spec: retained ? sql.json({ name: slug, namespace: "commerce-production", task_groups: [{ name: "web", count: i === 0 ? 2 : 1, tasks: [{ name: "app", image }] }] }) : null,
          started_at: new Date(Date.now() - (j + 4) * 86400000), created_at: new Date(Date.now() - (j + 4) * 86400000), completed_at: new Date(Date.now() - (j + 4) * 86400000 + 90000),
        })} RETURNING id`;
        if (i === 0 && retained) rollbackDeploymentId = older.id;
      }
      if (i < 2)
        await sql`INSERT INTO routes (project_id,environment_id,domain,service_id,port,protection_mode) VALUES (${project.id},${environment.id},${i === 0 ? "shop.acme.test" : "api.acme.test"},${service.id},3000,${i === 0 ? "none" : "bower_auth"})`;
      if (i === 0)
        await sql`INSERT INTO webhook_endpoints (service_id,environment_id,token_hash,token_prefix,signature_secret_hash,provider,deploy_mode,tag_filter) VALUES (${service.id},${environment.id},'audit-webhook-hash','wh_audit...','audit-signature-hash','ghcr','tag','^v.*')`;
    }
    // Metric history for Storefront only, so Checkout API shows the empty state. Three allocations (one stopped) at the sampler's
    // 30 s cadence for 24 h, with a short and a long gap (a failed sample writes no row), the first CPU of an
    // allocation null, and one stretch above the 1 core limit (500m x 2 replicas).
    const interval = 30_000;
    const end = Math.floor(Date.now() / interval) * interval;
    const sampleRows = [];
    // storefront-alloc-0 is the replica the 45 minute old release replaced: it stopped when the release started and
    // is still listed by the fake Trellis, so its allocation page shows history of an allocation that is no longer running.
    for (const [allocationIndex, startHoursAgo, stoppedMinutesAgo, allocationId] of [[0, 24, 0, "storefront-alloc-1"], [1, 2, 0, "storefront-alloc-2"], [2, 6, 45, "storefront-alloc-0"]]) {
      const nodeId = allocationIndex === 1 ? "node-eu-west-02" : "node-eu-west-01";
      for (let t = end - startHoursAgo * 3600_000; t <= end - stoppedMinutesAgo * 60_000; t += interval) {
        const minutesAgo = (end - t) / 60_000;
        if ((minutesAgo > 20 && minutesAgo < 30) || (minutesAgo > 190 && minutesAgo < 230)) continue;
        const phase = t / 60_000;
        const spike = minutesAgo > 36 && minutesAgo < 44 ? 700 : 0;
        const first = t === end - startHoursAgo * 3600_000;
        const cpu = allocationIndex === 2 ? 110 + 40 * Math.sin(phase / 17) + 20 * Math.sin(phase / 2.7) : 160 + 70 * Math.sin(phase / 23 + allocationIndex) + 30 * Math.sin(phase / 3.1) + spike + (allocationIndex ? 40 : 90);
        const memory = (allocationIndex === 2 ? 150 + (6 * 60 - (minutesAgo - stoppedMinutesAgo)) * 0.1 + 12 * Math.sin(phase / 29) : 180 + (24 * 60 - minutesAgo) * 0.12 + 20 * Math.sin(phase / 41) + allocationIndex * 60) * 1048576;
        sampleRows.push({ service_id: storefrontId, environment_id: environment.id, allocation_id: allocationId, node_id: nodeId, collected_at: new Date(t), cpu_millicores: first ? null : Math.round(cpu * 10) / 10, memory_bytes: Math.round(memory), task_count: 1 });
      }
    }
    for (let i = 0; i < sampleRows.length; i += 2000)
      await sql`INSERT INTO allocation_metric_samples ${sql(sampleRows.slice(i, i + 2000))}`;
    // The fake runtime and stored releases share an incarnation and durable
    // artifact pins, including the predecessor whose old track may be gone.
    await sql`UPDATE deployments SET trellis_incarnation = 'audit-incarnation',
      plan_diff = jsonb_build_object('resolved_images', jsonb_build_object(
        job_spec #>> '{task_groups,0,tasks,0,image}',
        (job_spec #>> '{task_groups,0,tasks,0,image}') || '@sha256:' || repeat('a', 64)
      )) WHERE job_spec IS NOT NULL`;
    await sql`INSERT INTO managed_proxies (environment_id,trellis_job_name,status,config_hash) VALUES (${environment.id},'bower-proxy','running','audit-config')`;
    for (const name of ["DATABASE_URL", "STRIPE_API_KEY"])
      await sql`INSERT INTO secrets_metadata (project_id,environment_id,name,trellis_secret_name,last_rotated_at) VALUES (${project.id},${environment.id},${name},${name === "DATABASE_URL" ? "database-url" : "stripe-api-key"},now())`;
    await sql`INSERT INTO notification_channels (project_id,type,name,config) VALUES (${project.id},'slack','Production alerts',${sql.json({ url: "https://hooks.slack.test/audit" })})`;
    await sql`INSERT INTO api_keys (org_id,user_id,name,key_hash,key_prefix,last_used_at) VALUES (${org.id},${owner.id},'GitHub Actions','audit-api-key-hash','bw_audit...',now())`;
    await sql`INSERT INTO invitations (org_id,token_hash,organization_role,note,reusable,max_uses,use_count,created_by_user_id,expires_at) VALUES (${org.id},${digest("audit-invite")},'member','Platform team onboarding',true,10,2,${owner.id},now()+interval '7 days')`;
    for (const action of [
      "service.deploy",
      "route.create",
      "secret.rotate",
      "team.member.add",
      "project.update",
    ])
      await sql`INSERT INTO audit_log (org_id,user_id,action,resource_type,resource_id,details) VALUES (${org.id},${owner.id},${action},${action.split(".")[0]},${project.id},${sql.json({ name: "Storefront", environment: "Production", before: "v2.3.0", after: "v2.4.1" })})`;
    // The latest hourly deployment outcomes stay unread, so the header shows the notifications badge.
    await sql`INSERT INTO notification_read_states (user_id,org_id,last_seen_at) VALUES (${owner.id},${org.id},now() - interval '150 minutes')`;
    await sql`INSERT INTO audit_log (org_id,action,resource_type,resource_id,details) VALUES (${org.id},'deployment.reconciled','deployment',${deploymentId},${sql.json({ name: "Storefront", before: { status: "deploying", image: "v2.3.0" }, after: { status: "healthy", image: "v2.4.1" } })})`;
    return {
      orgId: org.id,
      memberId: admin.id,
      deploymentId,
      failedDeploymentId,
      rolledBackDeploymentId,
      rollbackDeploymentId,
    };
  });
  // Clear only the harness-owned capture directories, so stale images cannot
  // make a failed scenario appear covered on a subsequent run.
  for (const dir of ["desktop", "narrow", "diagnostics", "screenshots", "results", "captures.json", "index.html"])
    await rm(`${output}/${dir}`, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/fixture.json`, JSON.stringify(fixture, null, 2));
  console.log("Seeded isolated connected-cluster UI audit.");
} finally {
  await sql.end();
}
