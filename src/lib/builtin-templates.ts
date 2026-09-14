export const BUILTIN_TEMPLATES = [
  { name: 'Static site', type: 'web' as const, description: 'Caddy-served assets with an HTTP health check.', config: { image: 'caddy:2-alpine', port: 80, replicas: 1, cpu: 100, memory: 134217728, healthCheckType: 'http', healthCheckPath: '/' } },
  { name: 'API service', type: 'web' as const, description: 'Rolling, route-ready API defaults.', config: { image: 'ghcr.io/example/api:latest', port: 8080, replicas: 2, cpu: 250, memory: 268435456, healthCheckType: 'http', healthCheckPath: '/health' } },
  { name: 'Background worker', type: 'worker' as const, description: 'Private restart-aware workload.', config: { image: 'ghcr.io/example/worker:latest', replicas: 1, cpu: 250, memory: 268435456 } },
  { name: 'Development Postgres', type: 'custom' as const, description: 'Single-node database with a managed local volume. Not for production.', config: { image: 'postgres:17-alpine', replicas: 1, cpu: 500, memory: 536870912, volumes: [{ name: 'data', host_path: '@/postgres-data', container_path: '/var/lib/postgresql/data' }], healthCheckType: 'script' } },
  { name: 'Proxy / load balancer', type: 'custom' as const, description: 'Route-aware Caddy starting point on Bower-managed namespace networking.', config: { image: 'caddy:2-alpine', port: 80, replicas: 1, cpu: 100, memory: 134217728 } },
]
