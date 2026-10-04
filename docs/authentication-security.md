# Authentication abuse controls and credential remediation

Login and public registration use shared PostgreSQL admission state, not per-process counters. Apply `0025_auth_abuse` before starting the updated application. Database errors fail closed. Public signup remains enabled.

The one-minute limits are 300 attempts globally, 150 per authentication family, 30 per source across all families, 10 per source and scope, and 50 per scope across sources. Login/registration scopes include normalized email; route-password scopes include route ID. Changing email or route ID cannot bypass source/family/global limits. Rejected traffic stops at the first exhausted broad limit, bounding retained counter rows. Expired rows are cleaned during admission.

## Trusted source contract

By default all anonymous requests share an `unknown` source. Caller-supplied `X-Forwarded-For` and `X-Real-IP` are **not trusted**. This conservative default can throttle unrelated users together.

An operator may set `BOWER_AUTH_SOURCE_HEADER` to a header name **only** when a trusted ingress strips any caller-supplied value, overwrites it with the actual client IP, and network policy prevents bypassing that ingress. The header must contain a single valid IPv4/IPv6 address; lists or malformed values use `unknown`. Merely setting the variable behind a proxy that forwards incoming headers permits spoofing. No ingress trust is automatically enabled by this change.

## Password processing and sessions

`hashPassword` and `verifyPassword` acquire a PostgreSQL-backed, nonqueued four-slot password-work lease shared across replicas. Callers must handle `PasswordWorkBusyError` as a retry/throttle response. Do not acquire a second lease around these helpers. Direct bcrypt consumers use `acquirePasswordWork()` and release its callback in `finally`. Leases expire after two minutes to recover from process death; this assumes bounded bcrypt work completes within that interval. New passwords are limited to 72 UTF-8 bytes to prevent bcrypt truncation; verification retains compatibility with existing passwords, with a 4,096-character input bound.

Absent login accounts perform a cost-12 dummy comparison. Registration hashes before checking existence, removing the fast timing path; its existing duplicate-email response still explicitly discloses account existence. Public signup and automatic session creation are preserved.

Password changes atomically replace the hash, delete all previous sessions (including the current one), and issue a fresh session cookie. Concurrent logins using an old verified hash cannot mint a surviving session after that transaction. The local terminal bridge is notified for each deleted session; other bridges reject revoked sessions on their existing 15-second persisted-session recheck.

## Operator remediation

Rotate durable Trellis operator tokens previously stored in affected organizations: earlier versions sent those credentials to member and administrator browsers. Treat them as potentially disclosed. The updated settings form never returns existing tokens to the browser and retains credentials when the replacement field is blank. Workload-identity injected credentials must not be copied into durable settings. This code change does **not** rotate external tokens.

Organization offboarding deletes that user's organization-scoped API keys, memberships in that organization's teams, and direct grants to its projects atomically. Other organizations and team-wide grants for remaining members are preserved. Instance administrators retain deliberate synthetic owner access when no explicit membership exists, matching interactive authorization; removing organization membership does not remove instance administrator privileges.
