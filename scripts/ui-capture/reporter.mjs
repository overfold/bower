import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);

// The reporter survives worker restarts, unlike a worker's afterAll hook.
export default class AuditReporter {
  constructor() {
    this.output = path.resolve(process.env.UI_AUDIT_OUTPUT || "ui-audit-output");
    this.captures = new Map();
  }

  onBegin(_config, suite) {
    for (const test of suite.allTests()) {
      const annotation = test.annotations.find((a) => a.type === "capture");
      if (annotation) this.captures.set(test.id, {
        name: test.title,
        ...JSON.parse(annotation.description),
        status: "missing",
      });
    }
  }

  onTestEnd(test, result) {
    const capture = this.captures.get(test.id);
    if (!capture) return;
    capture.status = result.status === "passed" ? "captured"
      : result.status === "skipped" ? "missing" : "failed";
    capture.error = result.errors.map((error) => error.message || "").join("\n");
  }

  async onEnd() {
    for (const layout of ["desktop", "narrow"]) {
      const scenarios = [...this.captures.values()].filter((s) => s.layout === layout);
      const inventory = {
        expected: scenarios.length,
        captured: scenarios.filter((s) => s.status === "captured").length,
        scenarios,
      };
      const dir = path.join(this.output, layout);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "captures.json"), JSON.stringify(inventory, null, 2));
      await writeFile(path.join(dir, "index.html"),
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bower UI audit — ${layout}</title><style>body{font:15px system-ui;background:#f4f4f1;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}article{background:white;padding:16px}img{width:100%;height:280px;object-fit:contain}code{overflow-wrap:anywhere}input{padding:10px;width:300px}</style><h1>Bower production UI audit — ${layout}</h1><p>${inventory.captured} / ${inventory.expected} captures · fake connected cluster only · 1× Chromium screenshots</p><p>Open a PNG for full resolution. Failed scenarios are retained below. Destructive dialogs are not confirmed.</p><input aria-label="Filter screens" placeholder="Filter screens" oninput="document.querySelectorAll('article').forEach(e=>e.hidden=!e.textContent.toLowerCase().includes(this.value.toLowerCase()))"><main>${scenarios.map((s) => `<article><h2>${escape(s.name)}</h2><code>${escape(s.route)}</code><p>${escape(s.status)}</p>${s.status === "captured" ? `<a href="screenshots/${escape(s.name)}.png"><img loading="lazy" src="screenshots/${escape(s.name)}.png" alt="${escape(s.name)}"></a>` : `<p>${escape(s.error || "Not captured")}</p>`}</article>`).join("")}</main>`);
    }
  }
}
