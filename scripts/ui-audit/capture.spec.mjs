import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const output = path.resolve(process.env.UI_AUDIT_OUTPUT || "ui-audit-output");
const fixture = JSON.parse(await readFile(`${output}/fixture.json`, "utf8"));
const project = "/projects/commerce";
const service = `${project}/services/storefront`;
const allocation = `${service}/allocations/storefront-alloc-1`;
const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).first().click();
const choose = async (page, name, option) => {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const rowAction = async (page, name, action, index = 0) => {
  await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).nth(index).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};

let authCookies;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill("alex@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Audit-only-2026!");
    await click(page, "Sign in");
    await page.waitForURL("**/dashboard");
    // Keep the real login cookies in memory only, never in the artifact.
    authCookies = await context.cookies();
  } finally {
    await context.close();
  }
});

// Each entry is an independently exercised state, not a screenshot of a mocked DOM.
const pages = [
  ["root", "/", "Create and manage projects"],
  ["settings-redirect", "/settings", "Organizations"],
  ["dashboard", "/dashboard", "Home"],
  ["projects", "/projects", "Projects"],
  ["deployments", "/deployments", "Deployments"],
  ["audit-log", "/audit", "Audit log"],
  ["cluster", "/status", "Status"],
  ["node-detail", "/status/node-eu-west-01", "Ready"],
  ["node-draining", "/status/node-eu-west-03", "Node details"],
  ["project-overview", project, "Commerce Platform"],
  ["empty-project", "/projects/internal-tools", "Internal Tools"],
  ...[
    "access",
    "deployments",
    "environment",
    "integrations",
    "routes",
    "services",
    "settings",
    "volumes",
  ].map((tab) => [`project-${tab}`, `${project}/${tab}`, "Commerce Platform"]),
  [
    "deployment-diagnostics",
    `${project}/deployments/${fixture.deploymentId}`,
    "ghcr.io/acme/storefront:v2.4.1",
  ],
  [
    "deployment-failed-diagnostics",
    `${project}/deployments/${fixture.failedDeploymentId}`,
    "Health check failed",
  ],
  ["service-overview", service, "Storefront"],
  ["service-failed", `${project}/services/order-worker`, "Order Worker"],
  ...["advanced", "configuration", "mounts", "revisions"].map((tab) => [
    `service-${tab}`,
    `${service}/${tab}`,
    "Storefront",
  ]),
  ["allocation-detail", allocation, "cores"],
  ...[
    "account",
    "cluster",
    "domains",
    "instance",
    "members",
    "organization",
    "teams",
  ].map((tab) => [
    `settings-${tab}`,
    `/settings/${tab}`,
    tab === "account"
      ? "Account"
      : tab === "cluster"
        ? "Trellis connection"
        : tab[0].toUpperCase() + tab.slice(1),
  ]),
  ["member-detail", `/settings/members/${fixture.memberId}`, "Sam Rivera"],
  ["invitation", "/invite/audit-invite", "Join Acme Cloud"],
  [
    "invitation-invalid",
    "/invite/invalid-audit-token",
    "This invitation is invalid.",
  ],
  [
    "not-found",
    "/projects/missing-audit-project",
    "Page not found",
  ],
];
const dialogs = [
  ["new-project", "/projects", "New project"],
  ["new-service", `${project}/services`, "New service"],
  ["grant-access", `${project}/access`, "Grant access"],
  [
    "revoke-team-access",
    `${project}/access`,
    "Revoke access for Platform Engineering",
  ],
  ["revoke-user-access", `${project}/access`, "Revoke access for Jamie Chen"],
  ["add-secret", `${project}/environment`, "Add secret"],
  ["delete-secret", `${project}/environment`, "Delete database-url"],
  ["service-environment", `${project}/environment`, "Edit variables"],
  ["add-route", `${project}/routes`, "Add route"],
  [
    "route-protection",
    `${project}/routes`,
    "Protection",
  ],
  ["delete-route", `${project}/routes`, "Delete"],
  ["add-volume", `${project}/volumes`, "Add volume"],
  ["edit-volume", `${project}/volumes`, "Edit"],
  ["delete-volume", `${project}/volumes`, "Delete uploads"],
  ["add-webhook", `${project}/integrations`, "Add webhook"],
  [
    "delete-webhook",
    `${project}/integrations`,
    "Delete webhook for Storefront",
  ],
  ["add-channel", `${project}/integrations`, "Add channel"],
  ["delete-channel", `${project}/integrations`, "Delete Production alerts"],
  ["delete-project", `${project}/settings`, "Delete project"],
  ["rollback-service", service, "Roll back"],
  ["attach-volume", `${service}/mounts`, "Attach volume"],
  ["new-api-key", "/settings/account", "New key"],
  ["revoke-api-key", "/settings/account", "Revoke GitHub Actions"],
  ["add-domain", "/settings/domains", "Add domain"],
  ["delete-domain", "/settings/domains", "Delete domain"],
  ["new-organization", "/settings/instance", "New organization"],
  ["invite-people", "/settings/members", "Invite people"],
  [
    "revoke-invitation",
    "/settings/members",
    "Revoke invitation “Platform team onboarding”",
  ],
  ["new-team", "/settings/teams", "New team"],
  ["edit-team", "/settings/teams", "Edit Platform Engineering"],
  ["delete-team", "/settings/teams", "Delete Platform Engineering"],
  ["stop-allocation", allocation, "Stop"],
  ["terminal", allocation, "Terminal"],
];
const scenarios = pages.map(([name, route, ready]) => ({ name, route, ready }));
for (const [name, route, button] of dialogs)
  scenarios.push({
    name,
    route,
    setup: async (page) => {
      if (route === allocation)
        await expect(page.getByRole("combobox", { name: "Log task" })).toBeVisible();
      const menuActions = {
        "revoke-team-access": ["Platform Engineering", "Revoke access"],
        "revoke-user-access": ["Jamie Chen", "Revoke access"],
        "delete-secret": ["database-url", "Delete"],
        "route-protection": ["shop.acme.test", "Edit protection"],
        "delete-route": ["shop.acme.test", "Delete"],
        "edit-volume": ["uploads", "Edit"],
        "delete-volume": ["uploads", "Delete"],
        "delete-webhook": ["webhook for Storefront", "Delete"],
        "delete-channel": ["Production alerts", "Delete"],
        "edit-team": ["Platform Engineering", "Rename"],
        "delete-team": ["Platform Engineering", "Delete"],
        "delete-domain": ["acme-preview.test", "Delete"],
      }[name];
      if (menuActions) await rowAction(page, ...menuActions);
      else await click(page, button);
      await expect(
        page.locator('[role="dialog"], [role="alertdialog"]'),
      ).toBeVisible();
      if (name === "terminal")
        await expect(
          page.getByText("Connected", { exact: true }),
        ).toBeVisible();
    },
  });
const state = (name, route, setup, extra = {}) =>
  scenarios.push({ name, route, setup, ...extra });
state("add-variable", `${project}/environment`, async (page) => {
  await click(page, "Edit variables");
  await click(page, "Add variable");
  await expect(page.getByRole("dialog").getByLabel("Variable 3 name")).toBeVisible();
});
state("new-service-filled", `${project}/services`, async (page) => {
  await click(page, "New service");
  await page.getByLabel("Name", { exact: true }).fill("search-api");
  await page
    .getByLabel("Image", { exact: true })
    .fill("ghcr.io/acme/search:v1.0.0");
});
state("new-service-strategies", `${project}/services`, async (page) => {
  await click(page, "New service");
  await page.getByRole("combobox", { name: "Deployment strategy", exact: true }).click();
  await expect(page.getByRole("option", { name: "Canary", exact: true })).toBeVisible();
});
for (const mode of ["Password", "Bower account"])
  state(
    `add-route-${mode === "Password" ? "password" : "bower-auth"}`,
    `${project}/routes`,
    async (page) => {
      await click(page, "Add route");
      await page.getByLabel("Hostname prefix").fill("preview");
      await choose(page, "Access protection", mode);
    },
  );
state("route-protection-password", `${project}/routes`, async (page) => {
  await rowAction(page, "shop.acme.test", "Edit protection");
  await choose(page, "Access protection", "Password");
});
for (const target of ["Env var", "File"])
  state(
    `secret-binding-${target === "File" ? "file" : "env"}`,
    `${project}/environment`,
    async (page) => {
      await click(page, "Edit variables");
      await click(page, "Add binding");
      await choose(page, "Target", target);
    },
  );
for (const type of ["Script", "TCP", "None"])
  state(
    `configuration-health-${type.toLowerCase()}`,
    `${service}/configuration`,
    (page) => choose(page, "Type", type),
    { fullPage: true },
  );
state("configuration-strategies", `${service}/configuration`, (page) =>
  page
    .getByRole("combobox", { name: "Deployment strategy", exact: true })
    .click(),
);
state("advanced-isolation-options", `${service}/advanced`, (page) =>
  page.getByRole("combobox", { name: "Isolation", exact: true }).click(),
);
state("advanced-api-access-options", `${service}/advanced`, (page) =>
  page
    .getByRole("combobox", { name: "Workload API access", exact: true })
    .click(),
);
state("invite-member-limited", "/settings/members", async (page) => {
  await click(page, "Invite people");
  await choose(page, "Uses", "Limited uses");
  await page.getByLabel("Note", { exact: false }).fill("Contractor onboarding");
});
state("invite-instance-admin", "/settings/members", async (page) => {
  await click(page, "Invite people");
  await choose(page, "Instance role", "Instance admin");
});
state("profile-menu", "/dashboard", (page) => click(page, "Profile menu"));
state("organization-picker", "/dashboard", (page) => click(page, "Acme Cloud"));
for (const query of ["", "store", "unmatched-audit-search"])
  state(
    `command-palette-${query === "store" ? "results" : query ? "empty" : "open"}`,
    "/dashboard",
    async (page) => {
      await click(page, "Search");
      const input = page.getByPlaceholder("Search projects, services, pages…");
      await expect(input).toBeVisible();
      await input.fill(query);
    },
  );
state("add-team-member", "/settings/teams", async (page) => {
  await page.getByRole("link", { name: "Platform Engineering", exact: true }).click();
  await click(page, "Add member");
}, { covers: "/settings/teams/[teamId]" });
state("remove-team-member", "/settings/teams", async (page) => {
  await page.getByRole("link", { name: "Platform Engineering", exact: true }).click();
  await rowAction(page, "Sam Rivera", "Remove member");
});
state("projects-no-search-results", "/projects", (page) =>
  page
    .getByRole("searchbox", { name: "Filter projects" })
    .fill("unmatched-audit-search"),
);
state("members-no-search-results", "/settings/members", (page) =>
  page
    .getByRole("searchbox", { name: "Search members" })
    .fill("unmatched-audit-search"),
);
state("members-role-options", "/settings/members", (page) =>
  page.getByRole("combobox", { name: "Filter by organization role" }).click(),
);
state("deployments-project-filter", "/deployments", (page) =>
  page.getByRole("combobox", { name: "Filter by project" }).click(),
);
for (const [name, route] of [
  ["login", "/login"],
  ["register", "/register"],
  ["invitation-login-redirect", "/invite/audit-invite"],
  [
    "protected-route",
    "/route-auth/password?route=audit&returnTo=https%3A%2F%2Fpreview.acme.test",
  ],
  [
    "protected-route-error",
    "/route-auth/password?route=audit&returnTo=https%3A%2F%2Fpreview.acme.test&error=invalid-password",
  ],
  ["protected-route-invalid", "/route-auth/password"],
])
  state(name, route, undefined, { public: true });
state(
  "login-error",
  "/login",
  async (page) => {
    await page.getByLabel("Email address").fill("alex@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("intentionally-wrong");
    await click(page, "Sign in");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  },
  { public: true },
);
for (const [name, route] of [
  ["dashboard", "/dashboard"],
  ["projects", "/projects"],
  ["project-services", `${project}/services`],
  ["service-overview", service],
  ["cluster", "/status"],
  ["settings-members", "/settings/members"],
  ["settings-account", "/settings/account"],
  ["project-environment", `${project}/environment`],
  ["service-configuration", `${service}/configuration`],
  ["audit-log", "/audit"],
])
  state(`narrow-${name}`, route, undefined, { narrow: true });
state(
  "narrow-navigation",
  "/dashboard",
  (page) => click(page, "Open navigation"),
  { narrow: true },
);
state(
  "narrow-add-route",
  `${project}/routes`,
  (page) => click(page, "Add route"),
  { narrow: true },
);
state(
  "narrow-add-route-footer",
  `${project}/routes`,
  async (page) => {
    await click(page, "Add route");
    await page
      .getByRole("button", { name: "Create route", exact: true })
      .scrollIntoViewIfNeeded();
  },
  { narrow: true },
);

// Capture the single consent-based invitation flow. Direct add-by-email is intentionally absent.
state("invite-link", "/settings/members", async (page) => {
  await click(page, "Invite people");
  await expect(page.getByRole("button", { name: "Create invitation", exact: true })).toBeVisible();
  await expect(page.getByText("By email", { exact: false })).toHaveCount(0);
});
state("invite-custom-expiry", "/settings/members", async (page) => {
  await click(page, "Invite people");
  await choose(page, "Expires", "Custom");
  await page.getByLabel("Custom expiry").fill("2030-12-31T18:00");
});
state("member-actions", "/settings/members", (page) => click(page, "Actions for Sam Rivera"));
for (const [name, action] of [["remove-instance-admin", "Remove instance admin"], ["remove-organization-member", "Remove from organization"]])
  state(name, "/settings/members", async (page) => {
    await click(page, "Actions for Sam Rivera");
    await page.getByRole("menuitem", { name: action, exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });
state("delete-project-confirmed-name", `${project}/settings`, async (page) => {
  await click(page, "Delete project");
  await page.locator("#confirm-project-name").fill("commerce");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Delete project", exact: true })).toBeEnabled();
});
state("rollback-to-deployment", `${project}/deployments/${fixture.deploymentId}`, async (page) => {
  await page.getByRole("button", { name: /^Roll back to / }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
});
state("failed-deployment-rollback", `${project}/deployments/${fixture.failedDeploymentId}`, async (page) => {
  const sql = postgres(process.env.DATABASE_URL);
  let targetId;
  try {
    // The baseline older successes have no stored spec. Add one disposable,
    // eligible predecessor to exercise recovery without mutating that fixture.
    const [target] = await sql`
      INSERT INTO deployments (service_id, environment_id, image_after, strategy, status, trigger_type, job_spec, created_at, started_at, completed_at)
      SELECT failed.service_id, failed.environment_id, 'ghcr.io/acme/storefront:v2.3.0', 'rolling', 'healthy', 'manual',
        jsonb_set(success.job_spec, '{task_groups,0,tasks,0,image}', '"ghcr.io/acme/storefront:v2.3.0"'::jsonb),
        failed.created_at - interval '1 hour', failed.created_at - interval '1 hour', failed.created_at - interval '59 minutes'
      FROM deployments failed, deployments success
      WHERE failed.id=${fixture.failedDeploymentId} AND success.id=${fixture.deploymentId}
      RETURNING id`;
    targetId = target.id;
    await page.reload();
    const rollback = page.getByRole("button", { name: "Roll back to storefront:v2.3.0", exact: true });
    await expect(rollback).toHaveClass(/bg-brand-500/);
    await expect(page.getByRole("button", { name: "Redeploy", exact: true })).not.toHaveClass(/bg-brand-500/);
    await expect(page.getByRole("link", { name: "Edit configuration", exact: true })).toHaveAttribute("href", `${service}/configuration`);
    await expect(page.getByRole("link", { name: "View allocations", exact: true })).toBeVisible();
  } finally {
    if (targetId) await sql`DELETE FROM deployments WHERE id=${targetId}`;
    await sql.end();
  }
});
for (const [name, route] of [["organization", "/deployments"], ["project", `${project}/deployments`]])
  state(`${name}-deployments-page-two`, route, async (page) => {
    await click(page, "Next ›");
    await expect(page.locator("body")).toContainText("21–27 of 27");
  });
state("deployments-search-empty", "/deployments", async (page) => {
  await page.getByRole("searchbox", { name: "Search deployments" }).fill("unmatched-audit-search");
  await expect(page.locator("body")).toContainText("No deployments match the current filters.");
});
state("audit-system-diff", "/audit", async (page) => {
  await choose(page, "Filter by actor", "System");
  const event = page.getByRole("button").filter({ hasText: "System" });
  if (await event.getAttribute("aria-expanded") === "false") await event.click();
  await expect(page.locator("body")).toContainText("v2.3.0");
  await expect(page.locator("body")).toContainText("v2.4.1");
});
state("audit-actor-filter", "/audit", (page) => choose(page, "Filter by actor", "System"));
state("domain-dns-expanded", "/settings/domains", async (page) => {
  await page.getByText("Show DNS record", { exact: true }).first().click();
  await expect(page.locator("body")).toContainText("audit-pending");
});
state("configuration-dirty", `${service}/configuration`, async (page) => {
  await page.getByLabel("Container image", { exact: true }).fill("ghcr.io/acme/storefront:v2.5.0");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).scrollIntoViewIfNeeded();
});
state("advanced-dirty", `${service}/advanced`, async (page) => {
  await choose(page, "Isolation", "Sandboxed");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
});
for (const empty of [false, true])
  state(`allocation-logs-search-${empty ? "empty" : "results"}`, allocation, async (page) => {
    await page.getByRole("searchbox", { name: "Search logs" }).fill(empty ? "unmatched-audit-search" : "products");
    await expect(page.locator("pre")).toContainText(empty ? "No matching log lines." : "GET /products");
    await page.getByRole("searchbox", { name: "Search logs" }).scrollIntoViewIfNeeded();
  });
state("allocation-logs-follow-wrap", allocation, async (page) => {
  await page.getByRole("switch", { name: "Follow", exact: true }).check();
  await page.getByRole("switch", { name: "Wrap", exact: true }).check();
  await expect(page.getByRole("switch", { name: "Follow", exact: true })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Wrap", exact: true })).toBeChecked();
});
state("recent-projects-navigation", "/status", async (page) => {
  await page.goto(project);
  await expect(page.getByRole("heading", { name: "Commerce Platform", exact: true })).toBeVisible();
  await page.goto("/status");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Commerce Platform", exact: true })).toBeVisible();
});
state("dashboard-live-health", "/dashboard", async (page) => {
  const allocationTile = page.locator("section").filter({ hasText: "Allocation health" }).first();
  await expect(allocationTile).toContainText("4/5 healthy");
  await expect(allocationTile).toContainText("1 failing");
  const worker = page.locator("body").getByText("Order Worker", { exact: true }).first().locator("xpath=ancestor::*[self::tr or self::a or self::div][1]");
  await expect(worker).toContainText("Down");
});
state("project-deployments-scoped", `${project}/deployments`, async (page) => {
  await expect(page.getByRole("combobox", { name: "Filter by project" })).toHaveCount(0);
  await expect(page.getByText("All projects", { exact: true })).toHaveCount(0);
});
state("variable-validation", `${project}/environment`, async (page) => {
  await click(page, "Edit variables");
  await click(page, "Add variable");
  const name = page.getByRole("dialog").getByLabel("Variable 3 name");
  await name.fill("PORT");
  await expect(page.getByRole("dialog").getByText("Variable names must be unique.", { exact: true })).toHaveCount(2);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("1INVALID");
  await expect(page.getByText(/Use uppercase letters, numbers, and underscores/)).toBeVisible();
});
state("focus-brand-500", "/projects", async (page) => {
  const control = page.getByRole("searchbox", { name: "Filter projects" });
  await control.focus();
  await expect(control).toHaveClass(/focus-visible:(?:border|ring)-brand-500/);
  await expect(control).toBeFocused();
});
state("focus-text-link", "/login", async (page) => {
  const link = page.getByRole("link", { name: "Create one", exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  expect(await link.evaluate((element) => getComputedStyle(element).outlineColor)).toBe("rgb(14, 108, 96)");
  expect(await link.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("2px");
}, { public: true });
state("row-delete-confirmation", `${project}/volumes`, async (page) => {
  await page.getByRole("button", { name: "Actions for uploads", exact: true }).click();
  const destructive = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(destructive).toHaveClass(/text-danger-600/);
  await destructive.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Delete uploads?");
  await expect(dialog.getByRole("button", { name: "Delete volume", exact: true })).toHaveClass(/danger/);
});
state("service-header-persists", service, async (page) => {
  await expect(page.getByRole("heading", { name: "Storefront", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Configuration", exact: true }).click();
  await expect(page).toHaveURL(`${service}/configuration`);
  await expect(page.getByRole("heading", { name: "Storefront", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
});
state("configuration-discard", `${service}/configuration`, async (page) => {
  const image = page.getByLabel("Container image", { exact: true });
  const original = await image.inputValue();
  await image.fill("ghcr.io/acme/storefront:discard-me");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await click(page, "Discard");
  await expect(image).toHaveValue(original);
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
});
state("invitation-named-context", "/invite/audit-invite", async (page) => {
  await expect(page.getByText(/Alex Morgan invited you to join Acme Cloud as member\./)).toBeVisible();
  await expect(page.getByText("alex@example.test", { exact: true })).toBeVisible();
});
state("public-not-found", "/invite/audit-invite/missing", async (page) => {
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
}, { public: true });
for (const [name, route] of [["overview", "/dashboard"], ["configuration", `${service}/configuration`]])
  state(`dark-${name}`, route, undefined, { dark: true });
state("narrow-new-service", `${project}/services`, (page) => click(page, "New service"), { narrow: true });
state("narrow-invite-people", "/settings/members", (page) => click(page, "Invite people"), { narrow: true });
state("service-deploy-confirmation", `${service}?action=deploy`, async (page) => {
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("Deploy this service?", { exact: true })).toBeVisible();
});

// Only disposable local records are created. Revoke them even if a later wait
// fails; do not record traces/storage state containing authentication cookies.
for (const kind of ["api-key", "invitation", "webhook"])
  state(
    `${kind}-created`,
    kind === "api-key"
      ? "/settings/account"
      : kind === "invitation"
        ? "/settings/members"
        : `${project}/integrations`,
    async (page) => {
      const sql = postgres(process.env.DATABASE_URL);
      try {
        if (kind === "api-key") {
          await click(page, "New key");
          await page
            .getByRole("dialog")
            .getByLabel("Name", { exact: true })
            .fill("Audit temporary key");
          await click(page, "Create key");
          await expect(
            page.getByText("Copy this key now. It will not be shown again."),
          ).toBeVisible();
          await page
            .locator("[role=dialog] code")
            .evaluate(
              (el) => (el.textContent = "[REDACTED — revoked audit key]"),
            );
        } else if (kind === "invitation") {
          await click(page, "Invite people");
          await page
            .locator("#invitation-note")
            .fill("Audit temporary invitation");
          await click(page, "Create invitation");
          await expect(
            page.getByRole("textbox", { name: "Invitation link" }),
          ).toBeVisible();
          await page
            .getByRole("textbox", { name: "Invitation link" })
            .evaluate(
              (el) => (el.value = "[REDACTED — revoked audit invitation]"),
            );
        } else {
          await click(page, "Add webhook");
          await choose(page, "Service", "Storefront");
          await click(page, "Create webhook");
          await expect(
            page.getByText(
              "Copy this webhook token now. It will not be shown again.",
            ),
          ).toBeVisible();
          await page.locator("[role=dialog] code, [role=dialog] pre").evaluateAll((elements) => {
            for (const el of elements) el.textContent = "[REDACTED — deleted audit token]";
          });
        }
      } finally {
        // Also scrub a partially completed success screen before Playwright's
        // automatic failure screenshot / error context is collected.
        await page.locator('[role="dialog"] code, [role="dialog"] pre').evaluateAll((elements) => {
          for (const el of elements)
            el.textContent = "[REDACTED — disposable audit credential]";
        });
        await page.getByRole("dialog").getByText(/^curl -X POST/).evaluateAll((elements) => {
          for (const el of elements) el.textContent = "curl -X POST '[REDACTED endpoint]' -H 'Authorization: Bearer <token>'";
        });
        await page
          .getByRole("textbox", { name: "Invitation link" })
          .evaluateAll((elements) => {
            for (const el of elements)
              el.value = "[REDACTED — disposable audit invitation]";
          });
        if (kind === "api-key")
          await sql`DELETE FROM api_keys WHERE name='Audit temporary key'`;
        if (kind === "invitation")
          await sql`DELETE FROM invitations WHERE note='Audit temporary invitation'`;
        if (kind === "webhook")
          await sql`DELETE FROM webhook_endpoints WHERE token_hash != 'audit-webhook-hash'`;
        await sql.end();
      }
    },
  );

test.afterAll(async () => {
  const results = await Promise.all(
    scenarios.map(async (scenario) => {
      try {
        return JSON.parse(
          await readFile(`${output}/results/${scenario.name}.json`, "utf8"),
        );
      } catch {
        return {
          name: scenario.name,
          route: scenario.route,
          status: "missing",
        };
      }
    }),
  );
  const inventory = {
    expected: scenarios.length,
    captured: results.filter((r) => r.status === "captured").length,
    scenarios: results,
  };
  await writeFile(
    `${output}/captures.json`,
    JSON.stringify(inventory, null, 2),
  );
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Bower UI audit</title><style>body{font:15px system-ui;background:#f4f4f1;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}article{background:white;padding:16px}img{width:100%;height:280px;object-fit:contain}code{overflow-wrap:anywhere}input{padding:10px;width:300px}</style><h1>Bower production UI audit</h1><p>${inventory.captured} / ${inventory.expected} captures · fake connected cluster only · 2× Chromium screenshots</p><p>Open a PNG for full resolution. Failed scenarios are retained below. Destructive dialogs are not confirmed.</p><input placeholder="Filter screens" oninput="document.querySelectorAll('article').forEach(e=>e.hidden=!e.textContent.toLowerCase().includes(this.value.toLowerCase()))"><main>${results.map((r) => `<article><h2>${escape(r.name)}</h2><code>${escape(r.route)}</code><p>${escape(r.status)}</p>${r.status === "captured" ? `<a href="screenshots/${escape(r.name)}.png"><img loading="lazy" src="screenshots/${escape(r.name)}.png" alt="${escape(r.name)}"></a>` : `<p>${escape(r.error)}</p>`}</article>`).join("")}</main>`,
  );
});

test("every UI page route is represented", async () => {
  async function routes(dir, parts = []) {
    const found = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        found.push(
          ...(await routes(
            path.join(dir, entry.name),
            entry.name.startsWith("(") ? parts : [...parts, entry.name],
          )),
        );
      else if (entry.name === "page.tsx") found.push("/" + parts.join("/"));
    }
    return found;
  }
  const actual = await routes("src/app");
  const missing = actual.filter((route) => {
    const pattern = new RegExp(
      "^" + route.replace(/\[[^\]]+\]/g, "[^/]+") + "$",
    );
    return !scenarios.some(
      (s) => s.covers === route || pattern.test(s.route.split("?")[0]),
    );
  });
  expect(missing, "Add new page routes to the audit scenario manifest").toEqual(
    [],
  );
});
for (const scenario of scenarios)
  test(scenario.name, async ({ page, context }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await mkdir(`${output}/screenshots`, { recursive: true });
    await mkdir(`${output}/results`, { recursive: true });
    try {
      if (scenario.narrow)
        await page.setViewportSize({ width: 390, height: 844 });
      if (scenario.dark) await page.emulateMedia({ colorScheme: "dark" });
      if (!scenario.public) {
        await context.addCookies([
          ...authCookies,
          {
            name: "bower_org",
            value: fixture.orgId,
            url: "http://127.0.0.1:3100",
          },
        ]);
      }
      await page.goto(scenario.route);
      const expectedPath =
        scenario.name === "root"
          ? "/projects"
          : scenario.name === "settings-redirect"
            ? "/settings/instance"
            : scenario.name === "invitation-login-redirect"
              ? "/login"
              : scenario.route.split("?")[0];
      await expect(page).toHaveURL((url) => url.pathname === expectedPath);
      await expect(page.locator("body")).not.toContainText(
        "Application error:",
      );
      await expect(page.locator("body")).not.toContainText(
        "Trellis is unavailable.",
      );
      if (!scenario.public) await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('[aria-busy="true"][aria-label^="Loading"]')).toHaveCount(0);
      if (scenario.ready)
        await expect(page.locator("body")).toContainText(scenario.ready);
      if (scenario.setup) await scenario.setup(page);
      await page.evaluate(() => document.fonts.ready);
      if (!scenario.setup || scenario.fullPage) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      }
      await page.screenshot({
        path: `${output}/screenshots/${scenario.name}.png`,
        fullPage: !scenario.setup || scenario.fullPage,
        animations: "disabled",
      });
      await expect(page.getByRole("heading", { name: "Page unavailable", exact: true })).toHaveCount(0);
      expect(browserErrors, "No client runtime errors").toEqual([]);
      await writeFile(
        `${output}/results/${scenario.name}.json`,
        JSON.stringify({
          name: scenario.name,
          route: scenario.route,
          status: "captured",
        }),
      );
    } catch (error) {
      await writeFile(
        `${output}/results/${scenario.name}.json`,
        JSON.stringify({
          name: scenario.name,
          route: scenario.route,
          status: "failed",
          error: error.message,
        }),
      );
      throw error;
    }
  });
