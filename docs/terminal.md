# Interactive allocation terminals

Bower uses Trellis's `trellis.exec.v1` WebSocket subprotocol, not the removed
custom HTTP upgrade transport. The browser connects to a same-origin
WebSocket at `/api/exec/stream`. Trellis tokens never leave the server.

The server-side relay remains necessary for Bower session authorization and
server-only Trellis credentials; Next route handlers do not expose a WebSocket
upgrade API. It relays binary messages without a custom byte-stream decoder.
The Caddy proxy under `proxy/` is unrelated application ingress infrastructure.

## Running and deploying

- `npm run dev` and `npm start` start `exec/server.mjs`, which supervises the
  stock Next server on **loopback at PORT + 1**. Only `PORT` should be exposed.
- The front server loads `.env*` with Next's environment loader, so file-based
  configuration such as `BOWER_PUBLIC_URL` and `TRELLIS_CA_CERT` applies to both
  the bridge and Next. Explicit process environment variables take precedence.
- The Docker image copies the generated Next standalone server, the front
  server modules, `ws` and `@next/env`; `entrypoint.sh` starts the front server. Do not launch
  the generated `server.js` directly: that bypasses terminal transport wiring.
- An ingress must support WebSocket upgrades and preserve the browser Host.
  Configure `BOWER_PUBLIC_URL` to the externally visible origin, particularly
  when the ingress rewrites Host. Forwarded headers are not authorization.
- Trellis exec requires HTTPS and validates certificates, using
  `TRELLIS_CA_CERT` if supplied or Node's trusted roots/extra CA. Plain HTTP is
  allowed only on loopback for isolated fixtures.
- Each replica owns only its connected streams. No cross-request session
  routing or shared in-memory stream registry is needed. Stream opens perform
  database session, project-role and explicit namespace/allocation ownership
  checks through a private loopback endpoint. A random per-process secret gates
  that endpoint; the public front server blocks it and strips its secret header.

## Flow control and lifecycle

Each binary WebSocket message carries one type byte followed by up to 32 KiB of
payload, matching Trellis's wire format; no length prefix is needed. Browser-only
type 8 acknowledges an output frame **after xterm renders it**; the bridge reads
no subsequent output until that acknowledgement. The upstream WebSocket stream
preserves message boundaries and pauses reads with a one-message high-water mark,
propagating backpressure rather than growing an output queue.
Input is split into 32 KiB frames, queued up to 128 KiB and serialized with
socket drain handling; overflowing that bound
terminates the stream rather than retaining an unbounded paste.

Type 6 is process exit; type 7 is a Trellis error; browser-only type 10 is a
transport/protocol error. EOF without status is never treated as success.
Dimensions are bounded to Trellis's 1–1000 range. Dialog close, task switch,
navigation, browser disconnect, server shutdown and failed authorization
rechecks destroy the upstream socket, which kills the Trellis process.

Logout revokes all streams for the session in the serving replica immediately.
Other replicas notice revoked/expired sessions and removed project access at
the next 15-second recheck (plus a bounded 10-second authorization timeout).
WebSocket ping/pong detects half-open browsers within 30 seconds. Stalled output
is closed after 30 seconds; absolute stream lifetime is eight hours. Admission
is capped at eight streams/session and 256 streams/replica.

## Validation

`npm test` covers WebSocket subprotocol negotiation, fragmented messages, raw
bytes, size boundaries, malformed frames, stdin/EOF/resize, output credit,
exit/error distinction, authorization
rejection, revocation/disconnect cleanup and blocked-input flooding. The
ownership tests intentionally use matching labels/job names in a wrong namespace.
Production verification must also build with `OUTPUT_MODE=standalone`, stage
the same files as the Docker runner, and exercise the terminal in a browser.
