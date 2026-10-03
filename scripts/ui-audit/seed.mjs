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
    await sql`INSERT INTO team_project_access (team_id,project_id,role) VALUES (${team.id},${project.id},'admin')`;
    await sql`INSERT INTO project_user_access (project_id,user_id,role) VALUES (${project.id},${viewer.id},'viewer')`;
    const [environment] =
      await sql`INSERT INTO environments (project_id,name,slug,trellis_namespace,env_vars) VALUES (${project.id},'Production','production','commerce-production',${sql.json({ NODE_ENV: "production", LOG_LEVEL: "info", REGION: "eu-west-1" })}) RETURNING *`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token,verified_at) VALUES (${org.id},'acme.test','audit-verified',now())`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token) VALUES (${org.id},'acme-preview.test','audit-pending')`;
    await sql`INSERT INTO organization_domains (org_id,domain,verification_token) VALUES (${org.id},'acme-staging.test','audit-staging')`;
    await sql`INSERT INTO project_volumes (project_id,environment_id,name,host_path) VALUES (${project.id},${environment.id},'uploads','@/commerce-uploads')`;
    await sql`INSERT INTO project_volumes (project_id,environment_id,name,host_path) VALUES (${project.id},${environment.id},'cache','@/commerce-cache')`;
    let deploymentId, failedDeploymentId;
    for (const [i, slug] of [
      "storefront",
      "checkout-api",
      "order-worker",
    ].entries()) {
      const name = ["Storefront", "Checkout API", "Order Worker"][i];
      const [service] =
        await sql`INSERT INTO services (project_id,name,slug) VALUES (${project.id},${name},${slug}) RETURNING *`;
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
      await sql`INSERT INTO service_configs ${sql({ ...config, environment_id: environment.id, active_job_name: slug })}`;
      for (const [j, status] of [
        "healthy",
        "failed",
        "rolled_back",
      ].entries()) {
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
        const [deployment] =
          await sql`INSERT INTO deployments ${sql({ service_id: service.id, environment_id: environment.id, image_before: `ghcr.io/acme/${slug}:v2.3.0`, image_after: config.image, strategy: config.deployment_strategy, status, trigger_type: j === 0 ? "webhook" : "manual", triggered_by_user_id: owner.id, trellis_job_name: slug, trellis_version: 3 - j, trellis_revision: 3 - j, job_spec: sql.json({ ...previous, task_groups: [{ ...previous.task_groups[0], tasks: [{ name: "app", image: config.image }] }] }), previous_job_spec: sql.json(previous), started_at: new Date(Date.now() - (j + 1) * 3600000), completed_at: new Date(Date.now() - (j + 1) * 3600000 + 90000), created_at: new Date(Date.now() - (j + 1) * 3600000) })} RETURNING *`;
        for (const [type, message] of [
          ["deployment.planned", "Deployment plan approved"],
          [
            status === "failed" ? "deployment.failed" : "deployment.completed",
            status === "failed"
              ? "Health check failed: /healthz returned 503"
              : "All allocations passed health checks",
          ],
        ]) {
          await sql`INSERT INTO deployment_events (deployment_id,type,message,details) VALUES (${deployment.id},${type},${message},${sql.json({ revision: 3 - j })})`;
        }
        if (i === 0 && j === 0) deploymentId = deployment.id;
        if (i === 0 && j === 1) failedDeploymentId = deployment.id;
      }
      // More than one page of history, without altering the latest release.
      for (let j = 0; j < 6; j++) {
        await sql`INSERT INTO deployments (service_id,environment_id,image_after,strategy,status,trigger_type,created_at,completed_at) VALUES (${service.id},${environment.id},${`ghcr.io/acme/${slug}:v2.2.${j}`},'rolling',${j === 0 ? 'failed' : 'healthy'},'manual',${new Date(Date.now() - (j + 4) * 86400000)},${new Date(Date.now() - (j + 4) * 86400000 + 90000)})`;
      }
      if (i < 2)
        await sql`INSERT INTO routes (project_id,environment_id,domain,service_id,port,protection_mode) VALUES (${project.id},${environment.id},${i === 0 ? "shop.acme.test" : "api.acme.test"},${service.id},3000,${i === 0 ? "none" : "bower_auth"})`;
      if (i === 0)
        await sql`INSERT INTO webhook_endpoints (service_id,environment_id,token_hash,token_prefix,signature_secret_hash,provider,deploy_mode,tag_filter) VALUES (${service.id},${environment.id},'audit-webhook-hash','wh_audit...','audit-signature-hash','ghcr','tag','^v.*')`;
    }
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
    await sql`INSERT INTO audit_log (org_id,action,resource_type,resource_id,details) VALUES (${org.id},'deployment.reconciled','deployment',${deploymentId},${sql.json({ name: "Storefront", before: { status: "deploying", image: "v2.3.0" }, after: { status: "healthy", image: "v2.4.1" } })})`;
    return {
      orgId: org.id,
      memberId: admin.id,
      deploymentId,
      failedDeploymentId,
    };
  });
  // Clear only the harness-owned capture directories, so stale images cannot
  // make a failed scenario appear covered on a subsequent run.
  for (const dir of ["screenshots", "results", "diagnostics"])
    await rm(`${output}/${dir}`, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/fixture.json`, JSON.stringify(fixture, null, 2));
  console.log("Seeded isolated connected-cluster UI audit.");
} finally {
  await sql.end();
}
