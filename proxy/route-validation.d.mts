export function validateRoute(route: Record<string, unknown>): void
export function parseRouteOptions(formData: FormData): {
  domain: string; pathPrefix: string; port: number; tlsMode: 'auto' | 'custom' | 'none';
  headers: Record<string, string>; responseHeaders: Record<string, string>;
  rateLimit: number | null; redirects: Array<{ from: string; to: string; code: number }>;
  tlsCertSecret: string | null; tlsKeySecret: string | null;
}
