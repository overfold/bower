export function acceptanceConfig(env) {
  if (env.BOWER_ACCEPTANCE_DISPOSABLE !== 'yes') {
    throw new Error('Set BOWER_ACCEPTANCE_DISPOSABLE=yes only for a dedicated disposable cluster.');
  }
  if (env.DATABASE_URL || env.TRELLIS_ADDR || env.TRELLIS_TOKEN) {
    throw new Error('Unset DATABASE_URL and workload-identity variables; the suite creates its own database.');
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS verification must remain enabled.');
  const required = ['ACCEPTANCE_TRELLIS_URL', 'ACCEPTANCE_TRELLIS_TOKEN',
    'ACCEPTANCE_BOWER_IMAGE', 'ACCEPTANCE_PROXY_IMAGE', 'ACCEPTANCE_SYNC_IMAGE',
    'ACCEPTANCE_IMAGE_V1', 'ACCEPTANCE_IMAGE_V2', 'ACCEPTANCE_DOMAIN'];
  for (const name of required) if (!env[name]) throw new Error(`Missing ${name}.`);
  const api = new URL(env.ACCEPTANCE_TRELLIS_URL);
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password ||
      api.pathname !== '/' || api.search || api.hash) throw new Error('Trellis URL must be an HTTP(S) origin without credentials.');
  const domain = env.ACCEPTANCE_DOMAIN;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) throw new Error('Use a dedicated lowercase DNS domain.');
  if (env.ACCEPTANCE_IMAGE_V1 === env.ACCEPTANCE_IMAGE_V2) throw new Error('Use distinct v1 and v2 images.');
  if (env.ACCEPTANCE_OLD_BOWER_IMAGE === env.ACCEPTANCE_BOWER_IMAGE) throw new Error('Upgrade baseline must differ from candidate.');
  return { api: api.origin, domain };
}
