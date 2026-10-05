import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceConfig } from './safety.mjs';

const env = {
  BOWER_ACCEPTANCE_DISPOSABLE: 'yes', ACCEPTANCE_TRELLIS_URL: 'https://trellis.example.test',
  ACCEPTANCE_TRELLIS_TOKEN: 'test-only', ACCEPTANCE_BOWER_IMAGE: 'bower:test',
  ACCEPTANCE_PROXY_IMAGE: 'proxy:test', ACCEPTANCE_SYNC_IMAGE: 'sync:test',
  ACCEPTANCE_IMAGE_V1: 'fixture:v1', ACCEPTANCE_IMAGE_V2: 'fixture:v2',
  ACCEPTANCE_DOMAIN: 'acceptance.example.test',
};
test('opt-in and isolated database are mandatory', () => {
  assert.throws(() => acceptanceConfig({ ...env, BOWER_ACCEPTANCE_DISPOSABLE: '' }), /DISPOSABLE/);
  assert.throws(() => acceptanceConfig({ ...env, DATABASE_URL: 'postgres://persistent/db' }), /Unset/);
  assert.throws(() => acceptanceConfig({ ...env, TRELLIS_TOKEN: 'ambient' }), /Unset/);
  assert.deepEqual(acceptanceConfig(env), { api: env.ACCEPTANCE_TRELLIS_URL, domain: env.ACCEPTANCE_DOMAIN });
});
test('reject unsafe origins, missing prerequisites, and indistinguishable images', () => {
  for (const url of ['file:///tmp/cluster', 'https://user:pass@example.test', 'https://example.test/path']) {
    assert.throws(() => acceptanceConfig({ ...env, ACCEPTANCE_TRELLIS_URL: url }), /origin/);
  }
  assert.throws(() => acceptanceConfig({ ...env, ACCEPTANCE_PROXY_IMAGE: '' }), /Missing/);
  assert.throws(() => acceptanceConfig({ ...env, ACCEPTANCE_DOMAIN: '*.example.test' }), /DNS/);
  assert.throws(() => acceptanceConfig({ ...env, ACCEPTANCE_IMAGE_V2: env.ACCEPTANCE_IMAGE_V1 }), /distinct/);
  assert.throws(() => acceptanceConfig({ ...env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /TLS/);
  assert.throws(() => acceptanceConfig({ ...env, ACCEPTANCE_OLD_BOWER_IMAGE: env.ACCEPTANCE_BOWER_IMAGE }), /baseline/);
});
