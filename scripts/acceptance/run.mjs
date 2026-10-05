// Real mutations: deliberately separate from npm test and fake UI capture.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveTxt } from 'node:dns/promises';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { chromium } from '@playwright/test';
import { acceptanceConfig } from './safety.mjs';

const env = process.env;
const config = acceptanceConfig(env); // Before any side effects.
const id = `bower-acceptance-${randomBytes(6).toString('hex')}`;
const dbName = `${id}-db`, webName = `${id}-web`;
const ingress = `${id}-ingress`, namespace = `${id}-production`;
const password = randomBytes(24).toString('hex');
const encryptionKey = randomBytes(32).toString('base64');
let sql, browser, baseURL, dbPort, webPort, stopping = false;
const owned = [];
let clusterTouched = false;

async function command(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    // Do not print command arguments, logs, database URLs, or credentials.
    child.stderr.resume();
    child.once('error', () => reject(new Error(`${file} could not start`)));
    child.once('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${file} exited ${code}`)));
  });
}
const docker = (...args) => command('docker', args);
async function poll(label, fn, timeout = 180_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Interrupted');
    try { const value = await fn(); if (value) return value; } catch { /* Retry readiness, not mutations. */ }
    await delay(1000);
  }
  throw new Error(`Timed out: ${label}`);
}
async function trellis(method, path) {
  const response = await fetch(`${config.api}/v1/namespaces/${path}`, {
    method, headers: { Authorization: `Bearer ${env.ACCEPTANCE_TRELLIS_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Trellis ${method} returned ${response.status}`);
  return response;
}
async function startWeb(image) {
  await docker('create', '--name', webName, '--network', id,
    '-p', `127.0.0.1:${webPort || ''}:3000`,
    '-e', `DATABASE_URL=postgres://bower:${password}@${dbName}:5432/bower_acceptance`,
    '-e', 'AUTO_MIGRATE=true', '-e', 'BOWER_RECONCILE_INTERVAL=2',
    '-e', `BOWER_PROXY_NAMESPACE=${ingress}`,
    '-e', `BOWER_CADDY_IMAGE=${env.ACCEPTANCE_PROXY_IMAGE}`,
    '-e', `BOWER_PROXY_SYNC_IMAGE=${env.ACCEPTANCE_SYNC_IMAGE}`,
    '-e', `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${encryptionKey}`,
    image);
  if (!owned.includes(webName)) owned.push(webName);
  await docker('start', webName);
  webPort = Number((await docker('port', webName, '3000/tcp')).split(':').at(-1));
  baseURL = `http://127.0.0.1:${webPort}`;
  await poll('Bower startup and migrations', async () => (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(5000) })).ok);
}
async function cleanup() {
  let failed = false;
  await browser?.close().catch(() => { failed = true; });
  // Stop reconciliation before deleting only this run's exact jobs.
  if (owned.includes(webName)) await docker('rm', '-f', '-v', webName).catch(() => { failed = true; });
  if (clusterTouched) {
    for (const [ns, name] of [[namespace, 'web'], [ingress, 'bower-ingress']]) {
      await trellis('DELETE', `${ns}/jobs/${name}`).catch(() => { failed = true; });
    }
  }
  await sql?.end({ timeout: 5 }).catch(() => { failed = true; });
  if (owned.includes(dbName)) await docker('rm', '-f', '-v', dbName).catch(() => { failed = true; });
  if (owned.includes(id)) await docker('network', 'rm', id).catch(() => { failed = true; });
  console.log(`Cleanup ${failed ? 'INCOMPLETE (inspect named resources)' : 'finished'}: ${id}`);
  console.log(`Destroy the disposable Trellis host to remove namespace volumes; remove DNS for ${config.domain}.`);
  if (failed) process.exitCode = 1;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });

try {
  console.log(`Run ${id}; dedicated cluster acknowledgement accepted. No shared cluster is safe.`);
  await docker('info');
  await docker('network', 'create', id); owned.push(id);
  await docker('create', '--name', dbName, '--network', id,
    '-p', '127.0.0.1::5432', '-e', 'POSTGRES_USER=bower', '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', 'POSTGRES_DB=bower_acceptance', 'postgres:16-alpine'); owned.push(dbName);
  await docker('start', dbName);
  dbPort = Number((await docker('port', dbName, '5432/tcp')).split(':').at(-1));
  sql = postgres(`postgres://bower:${password}@127.0.0.1:${dbPort}/bower_acceptance`, { max: 1 });
  await poll('disposable PostgreSQL', async () => { await sql`select 1`; return true; });
  await startWeb(env.ACCEPTANCE_OLD_BOWER_IMAGE || env.ACCEPTANCE_BOWER_IMAGE);
  const invite = await poll('bootstrap invitation', async () => (await docker('logs', webName)).match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1]);
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const choose = async (name, value) => {
    await page.getByRole('combobox', { name, exact: true }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
  };
  await page.goto(`${baseURL}/register?next=${encodeURIComponent(`/invite/${invite}`)}`);
  await page.getByLabel('Name', { exact: true }).fill('Acceptance operator');
  await page.getByLabel('Email address').fill(`${id}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await click('Create account');
  await click('Accept invitation');
  await page.waitForURL('**/projects');
  assert.equal((await sql`select count(*)::int as n from organization_members where role = 'owner'`)[0].n, 1);
  console.log('PASS install: migrations, bootstrap invitation, account and owner access');

  await page.goto(`${baseURL}/settings/cluster`);
  await page.getByLabel('Trellis API URL').fill(config.api);
  await page.getByLabel('Trellis API token').fill(env.ACCEPTANCE_TRELLIS_TOKEN);
  clusterTouched = true; // Saving credentials enables background ingress applies, even without routes.
  await click('Save changes');
  await page.getByText('Trellis settings saved', { exact: true }).waitFor();
  await page.goto(`${baseURL}/projects`);
  await click('New project');
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(id);
  await click('Create project');
  await page.waitForURL(`**/projects/${id}`);
  await click('New service');
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('web');
  await page.getByLabel('Image', { exact: true }).fill(env.ACCEPTANCE_IMAGE_V1);
  await click('Create service');
  await page.waitForURL(`**/projects/${id}/services/web`);
  const serviceURL = `${baseURL}/projects/${id}/services/web`;
  const [service] = await sql`select id from services where slug = 'web'`;
  // Fixture wiring only: mutations under test still use authenticated Bower actions.
  async function configure(image, health, readyDelay = '0') {
    await sql`update service_configs set image = ${image}, health_check_type = 'http',
      health_check_port = 8080, health_check_path = ${health}, health_check_interval = 2,
      health_check_timeout = 1, health_check_threshold = 1, auto_rollback_seconds = 120,
      env_vars = ${sql.json({ READY_DELAY_SECONDS: readyDelay })} where service_id = ${service.id}`;
  }
  async function deploy() {
    const before = await sql`select id from deployments where service_id = ${service.id}`;
    await page.goto(serviceURL);
    await click('Deploy');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deploy', exact: true }).click();
    return poll('accepted deployment', async () => {
      const rows = await sql`select * from deployments where service_id = ${service.id} order by created_at desc limit 1`;
      const row = rows[0];
      if (!row || before.some(old => old.id === row.id)) return false;
      if (row.status === 'failed') throw new Error('Deployment failed before acceptance');
      return row.trellis_incarnation && row.status === 'deploying' ? row : false;
    });
  }
  async function status(deployment, expected) {
    await poll(`deployment ${expected}`, async () => (await sql`select status from deployments where id = ${deployment.id}`)[0].status === expected);
  }
  async function https(version) {
    await poll(`trusted HTTPS serves ${version}`, async () => {
      const response = await fetch(`https://app.${config.domain}/`, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
      return response.ok && (await response.text()) === `bower-acceptance-${version}\n`;
    }, 300_000); // Normal trust store: never disable TLS verification.
  }
  await configure(env.ACCEPTANCE_IMAGE_V1, '/health', '10');
  const initial = await deploy(); await status(initial, 'healthy');
  console.log('PASS real image deploy and convergence');

  await page.goto(`${baseURL}/settings/domains`);
  await click('New domain');
  await page.getByRole('dialog').getByLabel('Domain', { exact: true }).fill(config.domain);
  await click('Create domain');
  const domain = await poll('domain registration', async () => (await sql`select * from organization_domains where domain = ${config.domain}`)[0]);
  console.log(`Add TXT _bower.${config.domain} = bower-verification=${domain.verification_token} (waiting up to 10 minutes).`);
  await poll('public DNS ownership TXT', async () => (await resolveTxt(`_bower.${config.domain}`)).some(parts => parts.join('') === `bower-verification=${domain.verification_token}`), 600_000);
  await click('Show DNS record');
  await click('Check verification');
  await poll('Bower DNS verification', async () => (await sql`select verified_at from organization_domains where id = ${domain.id}`)[0].verified_at);
  await page.goto(`${baseURL}/projects/${id}/routes`);
  await click('New route');
  await page.getByLabel('Hostname', { exact: true }).fill('app');
  await choose('Target service', 'web');
  await page.getByLabel('Port', { exact: true }).fill('8080');
  await click('Create route');
  await https('v1');
  console.log('PASS DNS ownership, managed ingress and publicly trusted HTTPS v1');

  if (env.ACCEPTANCE_OLD_BOWER_IMAGE) {
    await docker('rm', '-f', '-v', webName);
    await startWeb(env.ACCEPTANCE_BOWER_IMAGE);
    assert.equal((await sql`select status from deployments where id = ${initial.id}`)[0].status, 'healthy');
    await https('v1');
    console.log('PASS old-image database upgrade preserves release and HTTPS');
  } else console.log('NOT RUN old-image database upgrade (set ACCEPTANCE_OLD_BOWER_IMAGE)');
  await configure(env.ACCEPTANCE_IMAGE_V2, '/health', '45');
  const update = await deploy();
  await page.goto('about:blank'); // Prove background startup reconciliation, not a UI refresh action.
  assert.equal((await sql`select status from deployments where id = ${update.id}`)[0].status, 'deploying');
  await docker('restart', webName);
  await poll('Bower restart', async () => (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(5000) })).ok);
  await status(update, 'healthy'); await https('v2');
  console.log('PASS accepted update survives Bower restart and serves HTTPS v2');
  await configure(env.ACCEPTANCE_IMAGE_V1, '/fail');
  const failure = await deploy();
  await status(failure, 'rolled_back');
  assert.equal((await sql`select count(*)::int as n from deployment_events where deployment_id = ${failure.id} and type = 'auto_rollback'`)[0].n, 1);
  assert.equal((await sql`select image from service_configs where service_id = ${service.id}`)[0].image, env.ACCEPTANCE_IMAGE_V2);
  await poll('Trellis rollback runtime convergence', async () => {
    const response = await trellis('GET', `${namespace}/jobs/web`);
    if (!response.ok) return false;
    const job = await response.json();
    return job.healthy === job.desired && job.desired > 0 &&
      job.spec?.task_groups[0]?.tasks[0]?.image === env.ACCEPTANCE_IMAGE_V2;
  });
  await https('v2');
  console.log('PASS deliberately unhealthy accepted rollout automatically recovers previous HTTPS release');
} catch {
  console.error(`FAIL acceptance run ${id}; last PASS identifies the completed boundary. Credentials and bootstrap logs are withheld.`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
