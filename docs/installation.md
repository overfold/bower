# Installing Bower on Trellis

This guide deploys Bower to a Trellis cluster from the root [`trellis.yml`](../trellis.yml) manifest. You don't need to clone the repository.

## Before you start

You need:

- A running Trellis cluster and `trellisctl` configured with a credential that has `cluster/write` access.
- A node that can accept inbound TCP on ports 80 and 443. Bower's shared ingress uses host networking on those ports.
- For HTTPS, a hostname whose DNS you control.

The manifest deploys Bower, a bundled Postgres container, and shared ingress. It targets a **single-node** cluster:

- Bower and Postgres communicate over private namespace networking.
- Postgres data survives container crashes but is stored on the node. It does not replace backups or high availability.

For a multi-node or production deployment, use an external Postgres instance (see [step 1](#1-download-and-edit-the-manifest)).

## 1. Download and edit the manifest

```bash
curl -fsSL https://raw.githubusercontent.com/overfold/bower/main/trellis.yml -o bower.yml
```

Open `bower.yml` and review these settings:

- **Dashboard URL.** In the web task's `env` block, uncomment `BOWER_PUBLIC_URL` and set it to your public origin, such as `https://bower.example.com`. Then:
  - Point the hostname's DNS A record at the ingress node, and make sure any AAAA record reaches it too.
  - Allow inbound TCP on ports 80 and 443.

  Caddy obtains the HTTPS certificate automatically. If you leave `BOWER_PUBLIC_URL` commented out, Bower is served over HTTP only at `http://<node-ip>`.
- **Database credentials.** Replace the example `POSTGRES_PASSWORD` and use the same password in `DATABASE_URL`, URL-encoded. If Postgres has already initialized its data directory, changing these values does not change its credentials.
- **External database.** To use your own Postgres instead of the bundled one, remove the `db` task group and set `DATABASE_URL` to its connection string.
- **Images and resources.** The manifest uses the `latest` Bower image with small CPU and memory allocations. Pin the image version (see [Container images](#container-images)) and adjust resources as needed. The ingress proxy images also default to `latest`; set `BOWER_CADDY_IMAGE` and `BOWER_PROXY_SYNC_IMAGE` to pin them.

Keep the `platform` namespace. If you change it, you also need to update the database hostname, `BOWER_PROXY_NAMESPACE`, and the namespace in the commands below. The [configuration reference](configuration.md) lists every other setting.

## 2. Create the encryption key

```bash
openssl rand -hex 32 | trellisctl --namespace platform secrets set encryption-key --stdin
```

Create this key only once, and keep it when you update Bower. Every Bower instance must use the same key.

## 3. Apply the manifest

```bash
trellisctl --namespace platform jobs apply ./bower.yml --wait
```

`trellisctl` validates the manifest and applies it through the normal plan and apply path.

Keep your edited `bower.yml` for future updates. If you apply the manifest straight from GitHub, your settings are replaced by the repository defaults.

## 4. Create the first account

On first startup, Bower:

- creates a default organization that is already connected to the cluster, using the Trellis credentials injected through `api_access` (see [Trellis credentials](configuration.md#trellis-credentials));
- creates the shared `platform/bower-ingress` job, which serves the dashboard and application routes on ports 80 and 443;
- prints a single-use admin invitation link in its logs.

Find the `Bower — First Run Setup` banner in the logs:

```bash
trellisctl --namespace platform jobs logs bower --tail 50
```

Open the invitation link at your `BOWER_PUBLIC_URL`, or at `http://<node-ip>` if you didn't set one, and create the first account.

Ingress can take a moment to become healthy, and HTTPS can take a little longer while the certificate is issued. Port 3000 stays open for troubleshooting.

## Next steps

- To protect application routes with a Bower login, set both `BOWER_PUBLIC_URL` and `BOWER_ROUTE_AUTH_SECRET`. See the [configuration reference](configuration.md).
- To deploy from CI or on registry pushes, see [CI/CD automation](automation.md).

## Updating Bower

1. Change the Bower image tag in your saved `bower.yml`.
2. Apply it again with the command from [step 3](#3-apply-the-manifest).

With `AUTO_MIGRATE=true`, which the manifest sets, Bower applies pending database migrations on startup. Otherwise, run them before you start the new version. See [Database migrations](database-migrations.md).

Read the [release notes](https://github.com/overfold/bower/releases) before you update.

## Container images

Tagged releases publish `ghcr.io/overfold/bower:<version>` and update `ghcr.io/overfold/bower:latest`. The container listens on port 3000 and runs as a non-root user.
