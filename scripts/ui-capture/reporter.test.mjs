import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import AuditReporter from "./reporter.mjs";

test("workflow and local instructions install both audit browser engines with dependencies", async () => {
  for (const file of ["../../.github/workflows/ui-capture.yml", "../../docs/ui-audit.md"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const install = source.match(/npx playwright install ([^\n]+)/)?.[1].trim().split(/\s+/) ?? [];
    for (const argument of ["--with-deps", "chromium", "webkit"]) {
      assert.ok(install.includes(argument), `${file} must install ${argument}`);
    }
  }
});

test("galleries split layouts and retain passed, failed and missing captures", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "ui-audit-report-"));
  try {
    const reporter = new AuditReporter();
    reporter.output = output;
    const capture = (id, layout) => ({
      id, title: id,
      annotations: [{ type: "capture", description: JSON.stringify({ route: `/route?name=<${id}>`, layout }) }],
    });
    const tests = [capture("overview", "desktop"), capture("dialog", "desktop"), capture("unrun", "desktop"), capture("phone", "narrow"), { id: "coverage", annotations: [] }];
    reporter.onBegin({}, { allTests: () => tests });
    reporter.onTestEnd(tests[0], { status: "passed", errors: [] });
    // A failed capture may already have a PNG; it must not be labelled captured.
    reporter.onTestEnd(tests[1], { status: "failed", errors: [{ message: '<script>alert("bad")</script>' }] });
    reporter.onTestEnd(tests[3], { status: "passed", errors: [] });
    reporter.onTestEnd(tests[4], { status: "passed", errors: [] });
    await reporter.onEnd();
    const desktop = JSON.parse(await readFile(`${output}/desktop/captures.json`, "utf8"));
    const narrow = JSON.parse(await readFile(`${output}/narrow/captures.json`, "utf8"));
    assert.equal(desktop.expected, 3);
    assert.equal(desktop.captured, 1);
    assert.deepEqual(desktop.scenarios.map((s) => s.status), ["captured", "failed", "missing"]);
    assert.equal(narrow.expected, 1);
    assert.equal(narrow.captured, 1);
    assert.equal(narrow.scenarios[0].name, "phone");
    const html = await readFile(`${output}/desktop/index.html`, "utf8");
    assert.match(html, /screenshots\/overview\.png/);
    assert.doesNotMatch(html, /screenshots\/(dialog|phone)\.png/);
    assert.match(html, /&lt;script&gt;alert\(&quot;bad&quot;\)&lt;\/script&gt;/);
    assert.match(html, /Not captured/);
    assert.deepEqual((await readdir(output)).sort(), ["desktop", "narrow"]);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("workflow budget accepts 30 MB and rejects one byte over in each artifact", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ui-capture.yml", import.meta.url), "utf8");
  const script = workflow.match(/run: \|\n([\s\S]*?)      - name: Upload desktop/)[1].replace(/^          /gm, "");
  const cwd = await mkdtemp(path.join(tmpdir(), "ui-audit-budget-"));
  try {
    for (const layout of ["desktop", "narrow", "diagnostics"]) {
      const dir = path.join(cwd, "ui-audit-output", layout);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, "capture.png");
      await writeFile(file, "");
      const overhead = Number(spawnSync("du", ["-sb", dir], { encoding: "utf8" }).stdout.split("\t")[0]);
      await truncate(file, 30_000_000 - overhead);
      assert.equal(spawnSync("bash", ["-e", "-c", script], { cwd }).status, 0);
      await truncate(file, 30_000_001 - overhead);
      const result = spawnSync("bash", ["-e", "-c", script], { cwd, encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stdout, new RegExp(`${layout} exceeds the 30 MB`));
      await rm(dir, { recursive: true });
    }
    assert.equal((workflow.match(/if: always\(\) && steps.budget.outcome == 'success'/g) || []).length, 3);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
