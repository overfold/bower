import { test, expect, webkit } from "@playwright/test";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const output = path.resolve(process.env.UI_AUDIT_OUTPUT || "ui-audit-output");
const baseURL = process.env.UI_AUDIT_BASE_URL || "http://127.0.0.1:3100";
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
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.waitForFunction(() => Object.keys(document.querySelector('form') ?? {}).some((key) => key.startsWith('__reactProps$')));
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
  ["node-detail", "/status/node-eu-west-01", "Healthy"],
  ["node-draining", "/status/node-eu-west-03", "Node details"],
  ["system-allocation", "/status/allocations/bower-proxy-alloc-1", "System allocation · read-only"],
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
  ["allocation-detail", allocation, "Logs"],
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
    "This invitation link is invalid",
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
  ["add-secret", `${project}/environment`, "New secret"],
  ["delete-secret", `${project}/environment`, "Delete database-url"],
  ["service-environment", `${project}/environment`, "Paste .env"],
  ["add-route", `${project}/routes`, "New route"],
  [
    "route-protection",
    `${project}/routes`,
    "Protection",
  ],
  ["delete-route", `${project}/routes`, "Delete"],
  ["add-volume", `${project}/volumes`, "New volume"],
  ["edit-volume", `${project}/volumes`, "Edit"],
  ["delete-volume", `${project}/volumes`, "Delete uploads"],
  ["add-webhook", `${project}/integrations`, "New webhook"],
  [
    "delete-webhook",
    `${project}/integrations`,
    "Delete webhook for Storefront",
  ],
  ["add-channel", `${project}/integrations`, "New notification channel"],
  ["delete-channel", `${project}/integrations`, "Delete Production alerts"],
  ["delete-project", `${project}/settings`, "Delete project"],
  ["rollback-service", service, "Roll back…"],
  ["attach-volume", `${service}/mounts`, "Attach volume"],
  ["new-api-key", "/settings/account", "New key"],
  ["revoke-api-key", "/settings/account", "Revoke GitHub Actions"],
  ["add-domain", "/settings/domains", "New domain"],
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
        "route-protection": ["shop.acme.test", "Edit route"],
        "delete-route": ["shop.acme.test", "Delete"],
        "edit-volume": ["uploads", "Edit"],
        "delete-volume": ["uploads", "Delete"],
        "edit-team": ["Platform Engineering", "Rename"],
        "delete-team": ["Platform Engineering", "Delete"],
        "delete-domain": ["acme-preview.test", "Delete"],
      }[name];
      if (menuActions) await rowAction(page, ...menuActions);
      else await click(page, button);
      await expect(
        page.locator('[role="dialog"], [role="alertdialog"]'),
      ).toBeVisible();
      if (name === "terminal") {
        await expect(
          page.getByText("Connected", { exact: true }),
        ).toBeVisible();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Terminal · storefront-alloc-1' })).toBeVisible();
        const bottomGap = await dialog.evaluate((element) => element.getBoundingClientRect().bottom - element.querySelector('[aria-label="Interactive allocation terminal"]').parentElement.getBoundingClientRect().bottom);
        expect(bottomGap).toBeGreaterThanOrEqual(16);
      }
    },
  });
const state = (name, route, setup, extra = {}) =>
  scenarios.push({ name, route, setup, ...extra });
state("empty-project-environment", "/projects/internal-tools/environment", async (page) => {
  await expect(page.getByRole("heading", { name: "Variables", exact: true })).toBeVisible();
  await expect(page.getByText("No secrets", { exact: true })).toBeVisible();
});
for (const slug of ["commerce", "internal-tools"])
  state(`${slug}-unified-settings`, `/projects/${slug}/settings`, async (page) => {
    await expect(page.locator("#volumes")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Project settings", exact: true })).toBeVisible();
    const widths = await page.locator("#general > div > .rounded-xl, #access .rounded-xl, #integrations .rounded-xl, #volumes .rounded-xl").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
    expect(widths.length).toBeGreaterThan(0);
    expect(new Set(widths).size).toBe(1);
  }, { fullPage: true });
for (const tab of ["Details", "Lifecycle"])
  state(`allocation-${tab.toLowerCase()}`, allocation, async (page) => {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("heading", { name: tab, exact: true })).toBeVisible();
    if (tab === "Details") await expect(page.getByLabel("Sampling CPU usage")).toHaveCount(0);
  }, { fullPage: true });
state("failing-service-cause", `${project}/services/order-worker`, async (page) => {
  await click(page, "Failing");
  await expect(page.getByText("Worker could not reach database", { exact: true })).toBeVisible();
});
state("terminal-fullscreen", allocation, async (page) => {
  await click(page, "Terminal");
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await click(page, "Full screen");
  await expect(page.getByRole("button", { name: "Exit full screen", exact: true })).toBeVisible();
});
state("active-release-rollback-target", `${project}/deployments/${fixture.deploymentId}`, async (page) => {
  await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll back…", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll back to storefront:v2.4.1", exact: true })).toHaveCount(0);
}, { fullPage: true });
state("add-variable", `${project}/environment`, async (page) => {
  await click(page, "New variable");
  await expect(page.getByRole("dialog").getByLabel("Key", { exact: true })).toBeVisible();
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
for (const [name, route] of [['project', `${project}/environment`], ['service', `${service}/configuration`]]) {
  state(`variable-value-toggle-${name}`, route, async (page) => {
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'LOG_FORMAT', exact: true }) });
    const column = name === 'project' ? (await page.getByRole('columnheader').allTextContents()).indexOf('Storefront') : 1;
    const reveal = row.getByRole('cell').nth(column).getByRole('button', { name: 'Reveal value', exact: true });
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');
    await expect(row).not.toContainText('json');
    await reveal.click();
    await expect(row).toContainText('json');
    await expect(row.getByRole('button', { name: 'Hide value', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(row.getByRole('button', { name: 'Copy value', exact: true })).toBeVisible();
    expect(await row.getByRole('cell').nth(column).getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(['Copy value', 'Hide value']);
    await row.getByRole('button', { name: 'Hide value', exact: true }).click();
    await expect(row).not.toContainText('json');
    await expect(row.getByRole('button', { name: 'Copy value', exact: true })).toHaveCount(0);
    await reveal.focus();
    await reveal.press('Enter');
    await expect(row).toContainText('json');
    await page.getByRole('button', { name: 'New variable', exact: true }).focus();
    await expect(row).not.toContainText('json');
    const inherited = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'NODE_ENV', exact: true }) });
    await expect(inherited.getByRole('button', { name: 'Reveal value', exact: true })).toHaveCount(0);
    await reveal.click();
  });
}
state('grant-access-role-options', `${project}/access`, async (page) => {
  await click(page, 'Grant access');
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  for (const description of ['View project configuration and deployments.', 'View, deploy, and roll back services.', 'Manage settings, services, and project access.']) {
    await expect(page.getByRole('option').filter({ hasText: description })).toBeVisible();
  }
});
for (const mode of ["Password", "Bower account"])
  state(
    `add-route-${mode === "Password" ? "password" : "bower-auth"}`,
    `${project}/routes`,
    async (page) => {
      await click(page, "New route");
      await page.getByLabel("Hostname", { exact: true }).fill("preview");
      await choose(page, "Access protection", mode);
    },
  );
state("route-protection-password", `${project}/routes`, async (page) => {
  await rowAction(page, "shop.acme.test", "Edit route");
  await choose(page, "Access protection", "Password");
});
for (const target of ["Environment", "File"])
  state(
    `secret-binding-${target === "File" ? "file" : "env"}`,
    `${project}/environment`,
    async (page) => {
      await click(page, "New variable");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox").nth(0).click();
      await page.getByRole("option", { name: "Storefront", exact: true }).click();
      await dialog.getByRole("combobox").nth(1).click();
      await page.getByRole("option", { name: "Secret binding", exact: true }).click();
      await dialog.getByRole("combobox").nth(3).click();
      await page.getByRole("option", { name: target, exact: true }).click();
      await expect(dialog.getByRole('heading', { name: 'Bind secret', exact: true })).toBeVisible();
      await expect(dialog.getByLabel(target === 'Environment' ? 'Environment variable' : 'File path', { exact: true })).toHaveValue(target === 'Environment' ? 'DATABASE_URL' : '/run/trellis-secrets/database-url');
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
      if (query === 'store') {
        await expect(page.getByRole('option').first()).toHaveText('Storefront · Commerce Platform');
        await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('dialog').getByText('Services', { exact: true })).toBeVisible();
        await expect(page.getByRole('dialog').getByText('Actions', { exact: true })).toBeVisible();
      }
    },
  );
state('command-palette-recent', '/dashboard', async (page) => {
  await click(page, 'Search');
  await page.getByRole('combobox', { name: 'Search projects, services, pages' }).fill('store');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${service}$`));
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await click(page, 'Search');
  await expect(page.getByRole('dialog').getByText('Recent', { exact: true })).toBeVisible();
  await expect(page.getByRole('option').first()).toHaveText('Storefront · Commerce Platform');
});
state('search-clear-and-overflow-table', '/deployments', async (page) => {
  const search = page.getByRole('searchbox', { name: 'Search services, projects and images' });
  await expect(search).toHaveAttribute('placeholder', 'Search');
  await search.fill('unmatched-audit-search');
  await expect(page.getByText('No deployments match these filters', { exact: true })).toBeVisible();
  await click(page, 'Clear search');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('heading', { name: '27 deployments' })).toBeVisible();
  const previous = page.getByRole('button', { name: '‹ Previous', exact: true });
  await expect(previous).toBeDisabled();
  expect(await previous.evaluate((button) => getComputedStyle(button).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.setViewportSize({ width: 390, height: 844 });
  const region = page.getByRole('region', { name: '27 deployments' });
  await expect(region).toHaveAttribute('tabindex', '0');
  await region.focus();
  await expect(region).toBeFocused();
  expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('table').locator('..')).not.toHaveAttribute('tabindex', '0');
});
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
  state(name, route, name.startsWith('protected-route') ? async (page) => {
    await expect(page.getByText('Protected by Bower', { exact: true })).toBeVisible();
    await expect(page.getByText(/Manage deployments on Trellis/)).toHaveCount(0);
    if (name === 'protected-route-error') {
      const input = page.getByLabel('Password', { exact: true });
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute('aria-describedby', 'route-password-error');
      await expect(page.locator('#route-password-error')).toHaveText('Incorrect password. Try again.');
    }
  } : undefined, { public: true });
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
for (const [name, options] of [
  ['no-organization', {}],
  ['no-organization-narrow', { narrow: true }],
  ['no-organization-dark', { dark: true }],
  ['no-organization-narrow-dark', { narrow: true, dark: true }],
])
  state(name, '/login', async (page) => {
    await page.getByLabel('Email address').fill('taylor.wilson.with.a.long.address@example.test');
    await page.getByLabel('Password', { exact: true }).fill('Audit-only-2026!');
    await click(page, 'Sign in');
    await expect(page).toHaveURL('/no-organization');
    await expect(page.getByRole('heading', { name: 'No organization access' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Check access' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }, { public: true, covers: '/no-organization', ...options });

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
  (page) => click(page, "New route"),
  { narrow: true },
);
state(
  "narrow-add-route-footer",
  `${project}/routes`,
  async (page) => {
    await click(page, "New route");
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
  await choose(page, "Expires", "Choose a date");
  await page.getByLabel("Expiry date").fill("2030-12-31");
});
state("member-actions", `/settings/members/${fixture.memberId}`, async (page) => {
  await expect(page.getByRole('heading', { name: 'Danger zone', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actions for Sam Rivera', exact: true })).toHaveCount(0);
});
state("remove-instance-admin", `/settings/members/${fixture.memberId}`, async (page) => {
  await choose(page, "Instance role", "User");
  await click(page, "Save");
  await expect(page.getByRole("alertdialog")).toContainText("Remove Sam Rivera as instance administrator?");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Remove instance admin and save", exact: true })).toBeVisible();
});
state("remove-organization-member", `/settings/members/${fixture.memberId}`, async (page) => {
  await click(page, "Remove from organization");
  await expect(page.getByRole("alertdialog")).toBeVisible();
});
state("delete-project-confirmed-name", `${project}/settings`, async (page) => {
  await click(page, "Delete project");
  await page.locator("#confirm-project-name").fill("commerce");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Delete project", exact: true })).toBeEnabled();
});
state("rollback-to-deployment", `${project}/deployments/${fixture.rollbackDeploymentId}`, async (page) => {
  await click(page, 'Roll back…');
  await expect(page.getByRole("alertdialog")).toBeVisible();
});
state("failed-deployment-rollback", `${project}/deployments/${fixture.failedDeploymentId}`, async (page) => {
  await expect(page.getByText(/Superseded by/)).toBeVisible();
  const rollback = page.getByRole("button", { name: "Roll back…", exact: true });
  await expect(rollback).not.toHaveClass(/bg-brand-500/);
  await expect(page.getByRole("button", { name: "Redeploy", exact: true })).not.toHaveClass(/bg-brand-500/);
  await expect(page.getByRole("link", { name: "Edit configuration", exact: true })).toHaveAttribute("href", `${service}/configuration`);
  await expect(page.getByRole("link", { name: "Open allocation", exact: true })).toBeVisible();
});
for (const [name, route] of [["organization", "/deployments"], ["project", `${project}/deployments`]])
  state(`${name}-deployments-page-two`, route, async (page) => {
    await click(page, "Next ›");
    await expect(page.locator("body")).toContainText("21–27 of 27");
  });
state("deployments-search-empty", "/deployments", async (page) => {
  await page.getByRole("searchbox", { name: "Search services, projects and images" }).fill("unmatched-audit-search");
  await expect(page.locator("body")).toContainText("No deployments match these filters");
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
  await expect(page.getByText('1 unsaved field', { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).scrollIntoViewIfNeeded();
});
state("advanced-dirty", `${service}/advanced`, async (page) => {
  await choose(page, "Isolation", "Sandboxed");
  await expect(page.getByText('1 unsaved field', { exact: true })).toBeVisible();
});
state('configuration-advanced-toggle', `${service}/configuration`, async (page) => {
  const toggle = page.getByRole('button', { name: 'Toggle advanced configuration' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await choose(page, 'Isolation', 'Sandboxed');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('form').evaluate((form) => new FormData(form).get('runtime'))).toBe('runsc');
  await toggle.click();
  await expect(page.getByRole('combobox', { name: 'Isolation' })).toContainText('Sandboxed');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
});
for (const empty of [false, true])
  state(`allocation-logs-search-${empty ? "empty" : "results"}`, allocation, async (page) => {
    await page.getByRole("searchbox", { name: "Search logs" }).fill(empty ? "unmatched-audit-search" : "products");
    await expect(page.locator("#logs pre")).toContainText(empty ? "No matching log lines." : "GET /products");
    await expect(page.locator('#logs [role="status"]')).toHaveText(empty ? '0 matches' : '1 match');
    await expect(page.locator('#logs mark')).toHaveCount(empty ? 0 : 1);
    expect(await page.locator('#logs pre').evaluate((element) => element.clientHeight)).toBeGreaterThan(384);
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
  await expect(page.getByRole("heading", { name: /^Commerce Platform/ })).toBeVisible();
  await page.goto("/status");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Commerce Platform", exact: true })).toBeVisible();
});
state("dashboard-live-health", "/dashboard", async (page) => {
  const allocationTile = page.locator("section").filter({ hasText: "Allocation health" }).first();
  // Two Storefront replicas and Checkout are healthy; Order Worker fails.
  // Shared ingress lives in platform, outside the project's workload health.
  await expect(allocationTile).toContainText("3/4 healthy");
  await expect(allocationTile).toContainText("1 failing");
  const worker = page.getByRole("row").filter({ hasText: "order-worker-alloc-1" });
  await expect(worker).toContainText("Failing");
});
state("project-deployments-scoped", `${project}/deployments`, async (page) => {
  await expect(page.getByRole("combobox", { name: "Filter by project" })).toHaveCount(0);
  await expect(page.getByText("All projects", { exact: true })).toHaveCount(0);
});
state("variable-validation", `${project}/environment`, async (page) => {
  await click(page, "New variable");
  const name = page.getByRole("dialog").getByLabel("Key", { exact: true });
  await name.fill("1INVALID");
  await page.getByLabel("Value", { exact: true }).fill("audit-value");
  await click(page, "Create variable");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/Use a key starting with a letter or underscore/)).toBeVisible();
});
state("focus-brand-ring", "/projects", async (page) => {
  const control = page.getByRole("searchbox", { name: "Filter projects" });
  await control.focus();
  await expect(control).toHaveClass(/focus-visible:ring-\[3px\]/);
  await expect(control).toHaveClass(/focus-visible:ring-brand-100/);
  await expect(control).toHaveClass(/focus-visible:border-brand-500/);
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
  await expect(page.getByRole("link", { name: "Overview", exact: true }).last()).toBeVisible();
});
state("configuration-discard", `${service}/configuration`, async (page) => {
  const image = page.getByLabel("Container image", { exact: true });
  const original = await image.inputValue();
  await image.fill("ghcr.io/acme/storefront:discard-me");
  await expect(page.getByText('1 unsaved field', { exact: true })).toBeVisible();
  await click(page, "Discard");
  await expect(image).toHaveValue(original);
  await expect(page.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
});
state("configuration-variable-draft", `${service}/configuration`, async (page) => {
  const writes = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.postData()?.includes('envVars')) writes.push(request); });
  const sql = postgres(process.env.DATABASE_URL);
  const [original] = await sql`SELECT c.* FROM service_configs c JOIN services s ON s.id=c.service_id JOIN projects p ON p.id=s.project_id WHERE p.slug='commerce' AND s.slug='storefront'`;
  try {
    await page.getByLabel('Replicas', { exact: true }).fill('3');
    await page.getByLabel('CPU', { exact: true }).fill('0.75');
    await click(page, 'New variable');
    await page.getByRole('dialog').getByLabel('Key', { exact: true }).fill('CHECKLIST_DRAFT');
    await page.getByRole('dialog').getByLabel('Value', { exact: true }).fill('audit-only');
    await click(page, 'Create variable');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('2 fields, 1 variable', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    const [unsaved] = await sql`SELECT env_vars FROM service_configs WHERE id=${original.id}`;
    expect(unsaved.env_vars).not.toHaveProperty('CHECKLIST_DRAFT');
    await click(page, 'Discard');
    await expect(page.getByText('CHECKLIST_DRAFT', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Replicas', { exact: true })).toHaveValue(String(original.replicas));
    await click(page, 'Edit LOG_FORMAT');
    await page.getByRole('dialog').getByLabel('Value', { exact: true }).fill('checklist-value');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
    await click(page, 'Edit PORT');
    await click(page, 'Remove override');
    await page.getByLabel('Replicas', { exact: true }).fill('3');
    await expect(page.getByText('1 field, 2 variables', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    await click(page, 'Save changes');
    await expect(page.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
    expect(writes).toHaveLength(1);
    const [saved] = await sql`SELECT replicas, env_vars FROM service_configs WHERE id=${original.id}`;
    expect(saved.replicas).toBe(3);
    expect(saved.env_vars.LOG_FORMAT).toBe('checklist-value');
    expect(saved.env_vars).not.toHaveProperty('PORT');
    await page.reload();
    await expect(page.getByLabel('Replicas', { exact: true })).toHaveValue('3');
  } finally {
    await sql`UPDATE service_configs SET replicas=${original.replicas}, env_vars=${sql.json(original.env_vars)}, overrides=${original.overrides ? sql.json(original.overrides) : null} WHERE id=${original.id}`;
    await sql.end();
  }
});
state("checklist-inline-validation", `${project}/environment`, async (page) => {
  await click(page, 'New variable');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Key', { exact: true }).fill('1INVALID');
  await dialog.getByLabel('Value', { exact: true }).fill('audit-only');
  await click(page, 'Create variable');
  const key = dialog.getByLabel('Key', { exact: true });
  await expect(key).toBeFocused();
  await expect(key).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.locator('#' + await key.getAttribute('aria-describedby'))).toHaveClass(/text-danger-500/);
});
state("invitation-named-context", "/invite/audit-invite", async (page) => {
  await expect(page.getByText(/Alex Morgan invited you to join Acme Cloud as a member\./)).toBeVisible();
  await expect(page.getByText("alex@example.test", { exact: true })).toBeVisible();
});
state("public-not-found", "/invite/audit-invite/missing", async (page) => {
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
}, { public: true });
for (const [prefix, extra] of [["", {}], ["dark-", { dark: true }]])
  state(`${prefix}toast-success`, "/settings/account", async (page) => {
    await page.clock.install();
    const name = page.getByLabel("Name", { exact: true });
    const original = await name.inputValue();
    // Exercise a real save without changing the seeded profile.
    await name.fill("");
    await name.fill(original);
    await click(page, "Save changes");
    const region = page.getByRole("region", { name: "Status messages" });
    const dismiss = region.getByRole("button", { name: "Dismiss: Account updated", exact: true });
    await expect(dismiss).toBeVisible();
    await expect(region.locator('[aria-live="polite"]')).toContainText("Account updated");
    await expect(region.getByRole("status")).toHaveCount(0);
    await dismiss.focus();
    await page.clock.fastForward(6000);
    await expect(dismiss).toBeVisible();
  }, extra);
for (const [prefix, extra] of [["", {}], ["narrow-", { narrow: true }]]) {
  state(`${prefix}toast-danger`, service, async (page) => {
    await page.clock.install();
    // The fake cluster rejects writes; no deployment or allocation is changed.
    await click(page, "Restart");
    const region = page.getByRole("region", { name: "Status messages" });
    const dismiss = region.getByRole("button", { name: "Dismiss: Service action failed", exact: true });
    await expect(dismiss).toBeVisible();
    await expect(region.locator('[aria-live="assertive"]')).toContainText("Trellis rejected the request (405).");
    await expect(region.getByRole("alert")).toHaveCount(0);
    await page.clock.fastForward(6000);
    await expect(dismiss).toBeVisible();
  }, extra);
  state(`${prefix}trellis-banner-actions`, "/dashboard", undefined, { ...extra, capture: async (page, options) => {
    const sql = postgres(process.env.DATABASE_URL);
    const [original] = await sql`SELECT trellis_api_url FROM organizations WHERE id=${fixture.orgId}`;
    try {
      // An unreachable loopback endpoint exercises the real server-side banner.
      await sql`UPDATE organizations SET trellis_api_url='http://127.0.0.1:1' WHERE id=${fixture.orgId}`;
      await page.reload();
      const banner = page.getByRole("status").filter({ hasText: "Trellis is unavailable." });
      await expect(banner).toBeVisible();
      await expect(banner.getByRole("button", { name: "Retry connection", exact: true })).toBeVisible();
      await expect(banner.getByRole("link", { name: "Check connection settings", exact: true })).toHaveAttribute("href", "/settings/organization#connection");
      await expect(banner.getByRole("button", { name: /^Dismiss/ })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo(0, 0);
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await page.screenshot(options);
    } finally {
      await sql`UPDATE organizations SET trellis_api_url=${original.trellis_api_url} WHERE id=${fixture.orgId}`;
      await sql.end();
    }
  } });
}
for (const [name, route] of [["overview", "/dashboard"], ["configuration", `${service}/configuration`]])
  state(`dark-${name}`, route, undefined, { dark: true });
// Notifications: declared in this order because opening the menu marks its items read.
const notificationsButton = (page, name = /^Notifications/) => page.getByRole("button", { name });
const openNotifications = async (page) => {
  await notificationsButton(page).click();
  await expect(page.getByRole("menu", { name: "Notifications" })).toBeVisible();
};
const replaceNotificationFeed = async (page, response) => {
  await page.route("**/api/notifications", (route) => route.fulfill(response));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
};
state("notifications-unread", "/dashboard", async (page) => {
  await expect(notificationsButton(page, /^Notifications, \d+ unread$/)).toBeVisible();
});
state("notifications-open", "/dashboard", async (page) => {
  const markedRead = page.waitForResponse((response) => response.request().method() === "POST");
  await openNotifications(page);
  const menu = page.getByRole("menu", { name: "Notifications" });
  await expect(menu.getByRole("menuitem").filter({ hasText: "Unread:" }).first()).toBeVisible();
  await expect(menu.getByRole("menuitem").filter({ hasText: "Failed" }).first()).toHaveAttribute("href", /\/projects\/[^/]+\/deployments\//);
  await markedRead;
});
state("notifications-read", "/dashboard", async (page) => {
  await expect(notificationsButton(page, "Notifications")).toBeVisible();
});
state("narrow-notifications-open", "/dashboard", openNotifications, { narrow: true });
state("dark-notifications-open", "/dashboard", openNotifications, { dark: true });
state("notifications-empty", "/dashboard", async (page) => {
  await replaceNotificationFeed(page, { json: { items: [], unreadCount: 0, lastSeenAt: new Date().toISOString() } });
  await openNotifications(page);
  await expect(page.getByText("No deployment activity yet", { exact: true })).toBeVisible();
});
state("notifications-refresh-error", "/dashboard", async (page) => {
  const failed = page.waitForResponse("**/api/notifications");
  await replaceNotificationFeed(page, { status: 500, body: "Unavailable" });
  await failed;
  await openNotifications(page);
  await expect(page.getByText("Couldn't refresh. Showing earlier results.", { exact: true })).toBeVisible();
});
state("narrow-new-service", `${project}/services`, (page) => click(page, "New service"), { narrow: true });
state("narrow-invite-people", "/settings/members", (page) => click(page, "Invite people"), { narrow: true });
state("service-deploy-confirmation", `${service}?action=deploy`, async (page) => {
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("Deploy this service?", { exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => !url.searchParams.has("action"));
  await click(page, "Cancel");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await click(page, "Deploy");
  await expect(page.getByRole("alertdialog")).toContainText("Deploy this service?");
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
          await expect(page.getByRole("textbox", { name: "API key", exact: true })).toBeVisible();
        } else if (kind === "invitation") {
          await click(page, "Invite people");
          await page
            .locator("#invitation-note")
            .fill("Audit temporary invitation");
          await click(page, "Create invitation");
          await expect(
            page.getByRole("textbox", { name: "Invitation link" }),
          ).toBeVisible();
          await expect(page.getByText('Anyone with this link can join Acme Cloud as a member. It works once and expires in 7 days.', { exact: true })).toBeVisible();
        } else {
          await click(page, "New webhook");
          await choose(page, "Service", "Storefront");
          await click(page, "Create webhook");
          await expect(page.getByRole("textbox", { name: "Token", exact: true })).toBeVisible();
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
        await page.locator('[role="dialog"] input[readonly], [role="dialog"] textarea[readonly]').evaluateAll((elements) => {
          for (const el of elements) {
            el.value = "[REDACTED — disposable audit credential]";
            el.setAttribute("value", el.value);
          }
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
test('auth routing recovers from stale cookies and accounts without organizations', async ({ page, context }) => {
  const sql = postgres(process.env.DATABASE_URL);
  const email = `auth-routing-${Date.now()}@example.test`;
  try {
    await context.addCookies([{ name: 'bower_session', value: 'previous-installation-session', url: baseURL }]);
    await page.goto('/projects');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.goto('/register');
    await page.getByLabel('Name', { exact: true }).fill('New account');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Audit-only-2026!');
    await click(page, 'Create account');
    await expect(page).toHaveURL('/no-organization');
    await expect(page.getByRole('heading', { name: 'No organization access' })).toBeVisible();
    const [user] = await sql`SELECT id FROM users WHERE email=${email}`;
    const memberships = await sql`SELECT id FROM organization_members WHERE user_id=${user.id}`;
    expect(memberships).toHaveLength(0);
    for (const route of ['/projects', '/dashboard', '/projects/commerce/services/storefront/configuration', '/settings/members', '/status']) {
      await page.goto(route);
      await expect(page).toHaveURL('/no-organization');
      await expect(page.getByRole('heading', { name: 'No organization access' })).toBeVisible();
    }
    // The URL already reads /no-organization, so wait for the redirect to land
    // before changing membership underneath the in-flight navigation.
    const bouncedBack = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/no-organization' && url.searchParams.has('_rsc');
    });
    await page.getByRole('link', { name: 'Check access' }).click();
    await bouncedBack;
    await expect(page).toHaveURL('/no-organization');
    await expect(page.getByRole('heading', { name: 'No organization access' })).toBeVisible();
    await sql`INSERT INTO organization_members (org_id,user_id,role) VALUES (${fixture.orgId},${user.id},'member')`;
    await page.getByRole('link', { name: 'Check access' }).click();
    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await sql`DELETE FROM organization_members WHERE user_id=${user.id}`;
    await page.goto('/projects');
    await expect(page).toHaveURL('/no-organization');
    await click(page, 'Sign out');
    await expect(page).toHaveURL('/login');
    expect((await context.cookies()).some((cookie) => cookie.name === 'bower_session')).toBe(false);
    await page.goto('/login?next=%2Finvite%2Faudit-invite');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Audit-only-2026!');
    await click(page, 'Sign in');
    await expect(page).toHaveURL('/invite/audit-invite');
    await click(page, 'Accept invitation');
    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await page.goto('/no-organization');
    await expect(page).toHaveURL('/projects');
    await context.clearCookies();
    await page.goto('/no-organization');
    await expect(page).toHaveURL('/login');
  } finally {
    await sql`DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE email=${email})`;
    await sql`DELETE FROM users WHERE email=${email}`;
    await sql.end();
  }
});

test('create service omits health checks and renders the real create audit payload', async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await context.addCookies([...authCookies, { name: 'bower_org', value: fixture.orgId, url: baseURL }]);
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const page = await context.newPage();
    await page.goto(`${project}/services`);
    await click(page, 'New service');
    await expect(page.getByRole('dialog').getByLabel('Type', { exact: true })).toHaveCount(0);
    await page.getByLabel('Name', { exact: true }).fill('Audit checklist service');
    await page.getByLabel('Image', { exact: true }).fill('nginx:alpine');
    await click(page, 'Create service');
    await page.waitForURL('**/services/audit-checklist-service');
    for (const table of ['base_service_configs', 'service_configs']) {
      const [saved] = await sql`SELECT c.* FROM ${sql(table)} c JOIN services s ON s.id=c.service_id WHERE s.slug='audit-checklist-service'`;
      expect(saved.health_check_type).toBeNull();
      expect(saved.health_check_port).toBeNull();
      expect(saved.health_check_command).toEqual([]);
    }
    await page.goto('/audit');
    await expect(page.locator('dl').first()).toContainText('Audit checklist service');
    await expect(page.locator('dl').first()).toContainText('nginx:alpine');
    await expect(page.locator('dl').first()).not.toContainText('[object Object]');
    await mkdir(`${output}/desktop/screenshots`, { recursive: true });
    await page.screenshot({ path: `${output}/desktop/screenshots/real-created-audit.png` });
  } finally {
    await sql`DELETE FROM audit_log WHERE resource_id IN (SELECT id::text FROM services WHERE slug='audit-checklist-service')`;
    await sql`DELETE FROM services WHERE slug='audit-checklist-service'`;
    await sql.end();
    await context.close();
  }
});

test('mono URLs in Chrome and Linux WebKit at 100%', async ({ browser }) => {
  const safariApproximation = await webkit.launch();
  try {
    for (const [engine, name] of [[browser, 'chrome'], [safariApproximation, 'webkit']]) {
      const context = await engine.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
      try {
        // WebKit does not send production Secure cookies over this local HTTP
        // fixture; Chromium treats loopback as a secure-context exception.
        await context.addCookies([...authCookies.map((cookie) => ({ ...cookie, secure: false })), { name: 'bower_org', value: fixture.orgId, url: baseURL }]);
        const page = await context.newPage();
        for (const route of ['/settings/organization', '/settings/instance', '/settings/account', '/status']) {
          await page.goto(route);
          await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#main-content > div > div')).opacity) === 1);
          await page.evaluate(() => document.fonts.ready);
          const values = await page.locator('.font-mono').evaluateAll((elements) => elements.map((element) => element instanceof HTMLInputElement ? element.value : element.textContent).filter((value) => /^https?:/.test(value ?? '')));
          if (route !== '/status') expect(values.length).toBeGreaterThan(0);
          for (const value of values) expect(value).not.toMatch(/https?:\s+\/\//);
          await mkdir(`${output}/mono`, { recursive: true });
          await page.screenshot({ path: `${output}/mono/${name}-${route.split('/').at(-1)}.png`, fullPage: true });
        }
      } finally { await context.close(); }
    }
  } finally { await safariApproximation.close(); }
});
for (const scenario of scenarios)
  test(scenario.name, {
    annotation: {
      type: "capture",
      description: JSON.stringify({
        route: scenario.route,
        layout: scenario.narrow ? "narrow" : "desktop",
      }),
    },
  }, async ({ page, context }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const screenshots = `${output}/${scenario.narrow ? "narrow" : "desktop"}/screenshots`;
    await mkdir(screenshots, { recursive: true });
    if (scenario.narrow)
      await page.setViewportSize({ width: 390, height: 844 });
    if (scenario.dark) await page.emulateMedia({ colorScheme: "dark" });
    if (!scenario.public) {
      await context.addCookies([
        ...authCookies,
        {
          name: "bower_org",
          value: fixture.orgId,
          url: baseURL,
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
            : ["access", "integrations", "volumes"].some((section) => scenario.route === `${project}/${section}`)
              ? `${project}/settings`
              : scenario.route === '/settings/cluster' ? '/settings/organization'
              : scenario.route === `${service}/advanced` ? `${service}/configuration`
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
    const trellisRails = page.locator('main > div[aria-hidden="true"] > svg > g > line');
    if (await trellisRails.count()) {
      // Capture the normal fresh-visit background after its introductory reveal,
      // without advancing the slow vine growth or exercising the auth form.
      await expect.poll(() => trellisRails.evaluateAll((rails) =>
        rails.length > 0 && rails.every((rail) =>
          Number.parseFloat(getComputedStyle(rail).strokeDashoffset) === 0,
        ),
      ), { timeout: 10_000, message: 'Auth trellis introductory reveal has settled' }).toBe(true);
    }
    const screenshotOptions = {
      path: `${screenshots}/${scenario.name}.png`,
      fullPage: !scenario.setup || scenario.fullPage,
      scale: "css",
      animations: "disabled",
    };
    // Fixture-scoped captures keep their temporary state until the image is taken.
    if (scenario.capture) await scenario.capture(page, screenshotOptions);
    else await page.screenshot(screenshotOptions);
    await expect(page.getByRole("heading", { name: "Page unavailable", exact: true })).toHaveCount(0);
    expect(browserErrors, "No client runtime errors").toEqual([]);
  });
