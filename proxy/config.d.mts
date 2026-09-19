export interface CaddyRenderOptions {
  adminPort?: string
  httpPort?: string
  httpsPort?: string
}

export type ManagedProxyRoute = Record<string, unknown>

export function renderCaddyfile(
  routes: ManagedProxyRoute[],
  allocations: Array<Record<string, unknown>>,
  options?: CaddyRenderOptions,
): string

export function renderBootstrapCaddyfile(
  routes: ManagedProxyRoute[],
  options?: CaddyRenderOptions,
): string
