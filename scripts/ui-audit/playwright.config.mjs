import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.mjs",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  outputDir: `${cwd}/${process.env.UI_AUDIT_OUTPUT || "ui-audit-output"}/diagnostics`,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    timezoneId: "Europe/Madrid",
    locale: "en-GB",
    screenshot: "only-on-failure",
  },
  // Skip server startup when servers are managed externally.
  webServer: process.env.UI_AUDIT_EXTERNAL_SERVERS
    ? undefined
    : [
        {
          cwd,
          command: "node scripts/ui-audit/trellis.mjs",
          url: "http://127.0.0.1:8128/v1/nodes",
          reuseExistingServer: false,
        },
        {
          cwd,
          command: "npm start",
          url: "http://127.0.0.1:3100/login",
          reuseExistingServer: false,
          env: {
            NODE_ENV: "production",
            HOSTNAME: "127.0.0.1",
            PORT: "3100",
            BOWER_PUBLIC_URL: "http://127.0.0.1:3100",
            AUTO_MIGRATE: "false",
            BOWER_RECONCILE_INTERVAL: "86400",
          },
        },
      ],
});
