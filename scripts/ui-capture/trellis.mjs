import http from "node:http";
import { WebSocketServer } from "ws";
import { encodeFrame } from "../../exec/protocol.mjs";
const now = () => new Date().toISOString();
const names = ["storefront", "checkout-api", "order-worker", "bower-proxy"];
const ingressNamespace = process.env.BOWER_PROXY_NAMESPACE || "platform";
const allocations = (namespace) =>
  names.flatMap((job, i) =>
    Array.from({ length: i === 0 ? 2 : 1 }, (_, j) => ({
      id: `${job}-alloc-${j + 1}`,
      job,
      namespace: job === "bower-proxy" ? ingressNamespace : namespace || "commerce-production",
      group: "web",
      node_id: j ? "node-eu-west-02" : "node-eu-west-01",
      phase: i === 2 ? "failed" : "running",
      health: i === 2 ? "unhealthy" : "healthy",
      draining: false,
      generation: 1,
      job_revision: 3,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      last_transition_at: now(),
      attempt: 1,
      reason: i === 2 ? "exit_code" : "",
      message:
        i === 2 ? "Process exited with code 1; replacement scheduled" : "",
      ports: [{ host_port: 3000, container_port: 3000 }],
      endpoints: [
        {
          task: "app",
          address: "10.42.0.12",
          ports: [{ host_port: 3000, container_port: 3000 }],
        },
      ],
      labels: {
        "bower/service": job,
        "bower/project": "commerce",
        "bower/environment": "production",
        "bower/config-hash": "audit-config",
      },
    })),
  ).filter((allocation) => !namespace || allocation.namespace === namespace);
const spec = (name, namespace, version = "v2.4.1") => ({
  name,
  namespace,
  task_groups: [
    {
      name: "web",
      count: name === "storefront" ? 2 : 1,
      runtime: "runc",
      tasks: [
        {
          name: "app",
          image: `ghcr.io/acme/${name}:${version}`,
          resources: { cpu: 500, memory: 536870912 },
          env: { PORT: "3000" },
          health_check: {
            type: "http",
            path: "/healthz",
            port: 3000,
            interval: 10000000000,
            timeout: 2000000000,
            threshold: 3,
          },
        },
      ],
    },
  ],
});
const job = (name, namespace) => ({
  name,
  incarnation: "audit-incarnation",
  version: 3,
  revision: 3,
  desired: name === "storefront" ? 2 : 1,
  running: name === "order-worker" ? 0 : name === "storefront" ? 2 : 1,
  healthy: name === "order-worker" ? 0 : name === "storefront" ? 2 : 1,
  allocations: allocations(namespace).filter((a) => a.job === name),
  spec: spec(name, namespace),
  replacement_backoff:
    name === "order-worker"
      ? [
          {
            group: "web",
            job_revision: 3,
            failures: 3,
            last_failure_at: now(),
            reason: "exit_code",
            message: "Worker could not reach database",
            next_replacement_at: new Date(Date.now() + 30000).toISOString(),
          },
        ]
      : [],
});
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const namespace =
    p.match(/\/namespaces\/([^/]+)/)?.[1] || "commerce-production";
  let data;
  console.log(req.method, p);
  // Capture flows never need to mutate a real workload. Unexpected requests fail
  // rather than returning a fabricated success response.
  if (req.method !== "GET" && !p.endsWith("/jobs/plan")) {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Audit fixture is read-only" }));
    return;
  }
  if (p.endsWith("/events") && !p.includes("/allocations/")) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(": audit stream\n\n");
    return;
  }
  if (p === "/v1/auth/whoami")
    data = {
      kind: "operator",
      scope: "cluster",
      access: "write",
      created_at: now(),
    };
  else if (p === "/v1/nodes")
    data = ["healthy", "healthy", "draining"].map((status, i) => ({
      id: `node-eu-west-0${i + 1}`,
      host: `10.0.1.${10 + i}`,
      port: 8128,
      status,
      cpu: 7500,
      memory: 15 * 1073741824,
      cpu_capacity: 8000,
      memory_capacity: 16 * 1073741824,
      cpu_allocatable: 7500,
      memory_allocatable: 15 * 1073741824,
      cpu_usage: 0.23 + i * 0.12,
      memory_used: (4 + i) * 1073741824,
      memory_available: (12 - i) * 1073741824,
      metrics_at: now(),
      last_heartbeat: now(),
      version: "0.14.2",
      os: "linux",
      arch: "amd64",
      control_plane: i === 0 ? "voter" : "nonvoter",
      labels: {
        region: "eu-west-1",
        zone: `eu-west-1${String.fromCharCode(97 + i)}`,
      },
      capabilities: ["runc", "runsc", "wireguard"],
      volumes: ["commerce-uploads"],
    }));
  else if (p === "/metrics") {
    res.end(
      [1, 2, 3]
        .flatMap((i) => [
          `trellis_node_cpu_allocated_millicores{node_id="node-eu-west-0${i}"} ${i * 500 + 500}`,
          `trellis_node_memory_allocated_bytes{node_id="node-eu-west-0${i}"} ${i * 536870912}`,
        ])
        .join("\n"),
    );
    return;
  } else if (p === "/v1/cluster/settings")
    data = {
      job_limits: {
        max_replicas_per_task_group: 100,
        max_task_groups_per_job: 32,
        max_tasks_per_task_group: 16,
        max_desired_allocations: 500,
        max_desired_allocations_per_namespace: 1000,
        default_task_cpu: 100,
        default_task_memory: 134217728,
        max_task_cpu: 8000,
        max_task_memory: 17179869184,
      },
      reconciliation: {
        allocation_loss_timeout: 60000000000,
        replacement_backoff_base: 5000000000,
        replacement_backoff_max: 300000000000,
        replacement_stable_after: 60000000000,
        terminal_allocation_retention: 86400000000000,
      },
      network: { wireguard_pool: "10.42.0.0/16", wireguard_port_count: 1000 },
    };
  else if (p === "/v1/namespaces")
    data = ["commerce-production", "commerce-staging", "commerce-development"];
  else if (p.endsWith("/allocations"))
    data = allocations(p.includes("/namespaces/") ? namespace : undefined).filter(
      (a) =>
        !url.searchParams.get("job") || a.job === url.searchParams.get("job"),
    );
  else if (p.includes("/allocations/") && p.endsWith("/events"))
    data = ["pending", "placed", "starting", "running"].map((phase, i) => ({
      phase,
      message: [
        "Allocation scheduled",
        "Placed on node-eu-west-01",
        "Image pulled; starting app",
        "Health checks passed",
      ][i],
      at: new Date(Date.now() - (4 - i) * 60000).toISOString(),
    }));
  else if (p.includes("/allocations/") && p.endsWith("/metrics"))
    data = [
      {
        allocation_id: p.split("/")[5],
        task: "app",
        cpu_usage_nanoseconds: Date.now() * 200000,
        memory_usage_bytes: 148000000,
        collected_at: now(),
      },
    ];
  else if (p.endsWith("/logs")) {
    res.end(
      `${now()} INFO app booted version=v2.4.1\n${now()} INFO database connection established\n${now()} INFO listening on :3000\n${now()} INFO GET /healthz 200 2ms\n${now()} INFO GET /products 200 18ms\n`,
    );
    return;
  } else if (p.endsWith("/versions")) {
    const name = p.split("/")[5];
    data = [3, 2, 1].map((v) => ({
      version: v,
      revision: v,
      spec: spec(name, namespace, `v2.${v + 1}.1`),
      created_at: new Date(Date.now() - v * 3600000).toISOString(),
    }));
  } else if (p.endsWith("/jobs/plan")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    data = {
      action: "update",
      namespace,
      job: input.spec.name,
      base_incarnation: "audit-incarnation",
      base_version: 3,
      base_revision: 3,
      desired_allocations: 2,
      changes: [
        {
          operation: "change",
          path: "task_groups[0].tasks[0].image",
          before: "ghcr.io/acme/storefront:v2.3.0",
          after: input.spec.task_groups[0].tasks[0].image,
        },
      ],
    };
  } else if (p.endsWith("/jobs")) data = names.map((n) => job(n, namespace));
  else if (p.includes("/jobs/")) data = job(p.split("/")[5], namespace);
  else if (p.endsWith("/secrets"))
    data = ["database-url", "stripe-api-key"].map((name) => ({
      name,
      namespace,
      version: 2,
      created_at: now(),
      updated_at: now(),
      ciphertext_size: 128,
      key_id: "audit-key",
    }));
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Unimplemented audit fixture" }));
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
});
const ws = new WebSocketServer({ server });
ws.on("connection", (socket) => {
  socket.send(
    encodeFrame(4, "Connected to seeded audit container\r\n/ app $ "),
  );
  socket.on("message", (data) => {
    if (data[0] === 1) socket.send(encodeFrame(4, "\r\n/ app $ "));
  });
});
server.listen(8128, "127.0.0.1", () =>
  console.log("Fake Trellis audit fixture listening on 8128"),
);
