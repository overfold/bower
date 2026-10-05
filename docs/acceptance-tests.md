# Disposable real-Trellis acceptance

`npm run test:acceptance` is an **opt-in, destructive acceptance run**, not part of
`npm test` or the fake-cluster UI captures. It installs the Bower release container
on a private Docker network with a newly created PostgreSQL 16 container, then
drives Bower through Playwright against a real Trellis cluster. It does not install
or upgrade Trellis, publish images, change DNS, or touch shared infrastructure.
General production operations are outside this suite's scope.

## Prerequisites and authorization

- Explicit authorization to mutate a **dedicated disposable** Trellis host and
  dedicated DNS subtree. A namespace is not a security boundary: credentials are
  cluster-wide and ingress binds host ports 80/443. Never use a live/shared cluster,
  even if the generated names look isolated. `BOWER_ACCEPTANCE_DISPOSABLE=yes` is
  your acknowledgement, not automatic proof that the endpoint is disposable.
- Provision a clean real-runtime cluster using Trellis's
  [single-node installer](https://github.com/overfold/trellis/blob/main/docs/public/getting-started.md)
  on a disposable Debian/Ubuntu VM. Its
  [Vagrant tooling](https://github.com/overfold/trellis/blob/main/docs/developer/development.md#three-node-vagrant-demo)
  is another option, but remove demo jobs and arrange public ingress. Do not use
  Trellis's `integration`/injected runtime: simulated containers cannot verify
  registry pulls, namespace networking, health probes, or HTTPS.
- Runner: Node.js 22, `npm ci`, Docker daemon access, and Playwright Chromium
  (`npx playwright install chromium`, plus platform dependencies if needed).
  Docker must be local; loopback port mappings are how the runner reaches its
  fresh database and Bower. Bower's container must reach the Trellis API.
- Candidate Bower image built from the checkout (`docker build -t bower:acceptance .`)
  or a pinned release; matching Caddy and route-sync images from that release.
  All Trellis workload images must be pullable by the cluster. Private registry
  credentials must already be configured using Trellis's tooling.
- A dedicated public DNS subtree, e.g. `acceptance.example.net`, with
  `app.acceptance.example.net` pointing at the ingress node. Ports 80/443 must
  reach that node, be free, and permit ACME validation. Remove stale AAAA records.
  You must be able to add a new `_bower.<subtree>` TXT record while the run waits.
  The suite uses real public certificate issuance; repeated runs can hit ACME
  rate limits. Do not weaken TLS validation to get a green result.

## Prepare the two tiny workload images

The fixture listens on 8080, returns a distinct version body, supports a delayed
health probe, and has a permanently unhealthy `/fail` probe. Build and publish
these only to a registry/repository you are authorized to modify:

```sh
docker build --build-arg VERSION=v1 -t REGISTRY/bower-acceptance:v1 scripts/acceptance/fixture
docker build --build-arg VERSION=v2 -t REGISTRY/bower-acceptance:v2 scripts/acceptance/fixture
docker push REGISTRY/bower-acceptance:v1
docker push REGISTRY/bower-acceptance:v2
```

Prefer immutable digests for run inputs. The runner never builds or pushes images.

## Run

Unset ambient database/workload-identity variables; no `.env` file is loaded by
the runner and no existing database URL is accepted. Supply the operator token
through a secure environment mechanism, not a committed file or shell history.

```sh
unset DATABASE_URL TRELLIS_ADDR TRELLIS_TOKEN
export BOWER_ACCEPTANCE_DISPOSABLE=yes
export ACCEPTANCE_TRELLIS_URL=https://trellis.disposable.example.net
# Set ACCEPTANCE_TRELLIS_TOKEN securely (cluster write access).
export ACCEPTANCE_BOWER_IMAGE=bower:acceptance
export ACCEPTANCE_PROXY_IMAGE=ghcr.io/overfold/bower-proxy:RELEASE
export ACCEPTANCE_SYNC_IMAGE=ghcr.io/overfold/bower-proxy-sync:RELEASE
export ACCEPTANCE_IMAGE_V1=REGISTRY/bower-acceptance:v1
export ACCEPTANCE_IMAGE_V2=REGISTRY/bower-acceptance:v2
export ACCEPTANCE_DOMAIN=acceptance.example.net
npm run test:acceptance
```

During the run, add the printed TXT record using your authorized DNS workflow.
The runner waits up to ten minutes, then asks Bower to verify it via DNS. Bower
and its database are published only on loopback, not public interfaces. Generated
passwords, bootstrap invitation links, cookies, and Docker logs are not printed
or saved. Docker administrators can inspect container environments and logs;
keep the runner host trusted. Do not collect unredacted traces/logs as artifacts.

The runner prints `PASS` only after assertions for each boundary:

1. Container startup migrations, real bootstrap invitation/account, and owner access.
2. UI-created project/service and real image plan/apply with healthy convergence.
3. Domain ownership verification and a Bower-created automatic HTTPS route; a
   trusted, non-redirecting HTTPS request must return the exact v1 body.
4. Update to v2; verify Trellis acceptance and still-`deploying` persistence before
   restarting Bower. With the browser parked on a blank page, startup/background
   reconciliation must finish that same deployment; HTTPS must return v2.
5. Deploy an image with a deliberately failing HTTP probe. Require `rolled_back`,
   the automatic-rollback event, restoration of the v2 configuration, real Trellis
   healthy desired counts/image, and recovery of the exact v2 HTTPS response.

The suite writes image, health, delay, and deadline fixture values directly into
its disposable database. Configuration-form validation is **not** covered; deploy,
bootstrap, connection, domain and route mutations use authenticated Bower UI
actions. This is a bounded boundary test, not exhaustive UI or zero-downtime proof.
It runs sequentially, has bounded readiness waits, and never retries mutations.
Failure exits nonzero; the last `PASS` locates the completed boundary.

### Existing-database upgrade

Set `ACCEPTANCE_OLD_BOWER_IMAGE` to a compatible older pinned release. The initial
install, account, service, healthy deployment and HTTPS route are created by that
image. The runner replaces only the Bower container with the candidate on the
**same generated database**, lets normal startup migrations run, asserts the
stored healthy deployment survives, checks HTTPS v1, and performs the remaining
update/restart/rollback scenarios with the candidate. Cookies and the encryption
key remain stable. Choose a baseline whose UI/schema supports this suite's fields;
arbitrary historical releases are not supported. Matching candidate proxy images
are supplied throughout, so this does not test an ingress-image upgrade.

Without that variable the runner explicitly prints `NOT RUN` for upgrade; a
successful fresh-install run is not evidence of an upgrade. Record the baseline,
candidate, proxy and fixture digests, Trellis version, and each printed outcome
when using this as release evidence. Bower itself runs in Docker, not as a Trellis
job: installing Bower via `trellis.yml`, multi-node failover, and node/storage loss
are not covered by this small suite.

## Cleanup and interrupted runs

Normal success, failure, SIGINT and SIGTERM use `finally` cleanup: stop Bower's
reconciler first, delete only this run's exact `web` and `bower-ingress` Trellis
jobs, remove its PostgreSQL/Bower containers **and anonymous volumes**, then its
Docker network. Cleanup errors also cause a nonzero exit. Names share the printed
random `bower-acceptance-<id>` prefix; no wildcard deletion is performed.

Trellis namespace storage (including ingress certificate volumes) is not erased
by job deletion. **Destroy the disposable Trellis VM/cluster after the run** and
remove its traffic/TXT DNS records. This manual final teardown is required even
after a green run; the suite deliberately has no host-uninstall/volume-purge code.

After SIGKILL, runner/daemon loss, or `Cleanup INCOMPLETE`, inspect only the printed
run's names before manually removing them. Container names are `<id>-web` and
`<id>-db`; Docker network is `<id>`; workload namespace is `<id>-production` and
ingress namespace is `<id>-ingress`. Use the explicit Trellis context/endpoint,
never whichever context happens to be current. Destroying the dedicated VM is
the final cleanup fallback. Never run cluster-wide purge commands on shared hosts.

Safe local checks require neither Docker nor Trellis:

```sh
node --test scripts/acceptance/*.test.mjs
node --check scripts/acceptance/run.mjs
```

Passing these checks verifies guardrails/syntax, not real-cluster acceptance.
