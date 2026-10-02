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
    await click(page, "Continue");
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
  ["settings-redirect", "/settings", "Instance"],
  ["dashboard", "/dashboard", "Welcome, Alex."],
  ["projects", "/projects", "Projects"],
  ["deployments", "/deployments", "Deployments"],
  ["audit-log", "/audit", "Audit log"],
  ["cluster", "/status", "Cluster"],
  ["node-detail", "/status/node-eu-west-01", "Node details"],
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
    "Deployment diagnostics",
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
  ["allocation-detail", allocation, "mCPU"],
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
  ["invitation", "/invite/audit-invite", "Accept invitation"],
  [
    "invitation-invalid",
    "/invite/invalid-audit-token",
    "This invitation is invalid.",
  ],
  [
    "not-found",
    "/projects/missing-audit-project",
    "This page could not be found.",
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
  ["add-variable", `${project}/environment`, "Add variable"],
  ["delete-variable", `${project}/environment`, "Delete REGION"],
  ["add-secret", `${project}/environment`, "Add secret"],
  ["delete-secret", `${project}/environment`, "Delete database-url"],
  ["service-environment", `${project}/environment`, "Edit configuration"],
  ["add-route", `${project}/routes`, "Add route"],
  [
    "route-protection",
    `${project}/routes`,
    "Configure protection for api.acme.test",
  ],
  ["delete-route", `${project}/routes`, "Delete route shop.acme.test"],
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
  ["rollback-service", service, "Rollback"],
  ["attach-volume", `${service}/mounts`, "Attach volume"],
  ["new-api-key", "/settings/account", "New key"],
  ["revoke-api-key", "/settings/account", "Revoke GitHub Actions"],
  ["add-domain", "/settings/domains", "Add domain"],
  ["delete-domain", "/settings/domains", "Delete domain"],
  ["new-organization", "/settings/instance", "New organization"],
  [
    "remove-instance-admin",
    "/settings/members",
    "Remove administrator sam@example.test",
  ],
  ["add-member", "/settings/members", "Add member"],
  ["invite-member", "/settings/members", "Invite member"],
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
        await expect(page.locator("body")).toContainText("mCPU");
      await click(page, button);
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
state("new-service-filled", `${project}/services`, async (page) => {
  await click(page, "New service");
  await page.getByLabel("Name", { exact: true }).fill("search-api");
  await page
    .getByLabel("Image", { exact: true })
    .fill("ghcr.io/acme/search:v1.0.0");
});
for (const mode of ["Password", "Bower account (Viewer+)"])
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
  await click(page, "Configure protection for api.acme.test");
  await choose(page, "Access protection", "Password");
});
for (const target of ["Env var", "File"])
  state(
    `secret-binding-${target === "File" ? "file" : "env"}`,
    `${project}/environment`,
    async (page) => {
      await click(page, "Edit configuration");
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
  await click(page, "Invite member");
  await choose(page, "Uses", "Limited uses");
  await page.getByLabel("Note", { exact: false }).fill("Contractor onboarding");
});
state("invite-instance-admin", "/settings/members", async (page) => {
  await click(page, "Invite member");
  await choose(page, "Instance role", "Administrator");
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
state("team-expanded", "/settings/teams", (page) =>
  click(page, /^Platform Engineering\s+2\s*members$/),
);
state("add-team-member", "/settings/teams", async (page) => {
  await click(page, /^Platform Engineering\s+2\s*members$/);
  await click(page, "Add member");
});
state("remove-team-member", "/settings/teams", async (page) => {
  await click(page, /^Platform Engineering\s+2\s*members$/);
  await click(page, "Remove Sam Rivera");
});
state("projects-no-search-results", "/projects", (page) =>
  page
    .getByRole("textbox", { name: "Filter projects" })
    .fill("unmatched-audit-search"),
);
state("members-no-search-results", "/settings/members", (page) =>
  page
    .getByRole("textbox", { name: "Search members" })
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
    await click(page, "Continue");
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
          await click(page, "Invite member");
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
          await page
            .locator("[role=dialog] code")
            .evaluate(
              (el) => (el.textContent = "[REDACTED — deleted audit token]"),
            );
        }
      } finally {
        // Also scrub a partially completed success screen before Playwright's
        // automatic failure screenshot / error context is collected.
        await page.locator('[role="dialog"] code').evaluateAll((elements) => {
          for (const el of elements)
            el.textContent = "[REDACTED — disposable audit credential]";
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
    return !scenarios.some((s) => pattern.test(s.route.split("?")[0]));
  });
  expect(missing, "Add new page routes to the audit scenario manifest").toEqual(
    [],
  );
});
for (const scenario of scenarios)
  test(scenario.name, async ({ page, context }) => {
    await mkdir(`${output}/screenshots`, { recursive: true });
    await mkdir(`${output}/results`, { recursive: true });
    try {
      if (scenario.narrow)
        await page.setViewportSize({ width: 390, height: 844 });
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
