# Public integration security

## Notification destinations

Notification channels require credential-free HTTPS URLs. Every delivery uses a fresh TLS connection: DNS results are validated during socket lookup and passed directly to the connection, preserving hostname/certificate verification without a second lookup. All DNS candidates must be allowed. Private, loopback, link-local, multicast, reserved, IPv4-mapped private addresses and IPv6 transition mechanisms are denied; IPv6 is default-deny outside global unicast `2000::/3`. Redirects are never followed. Deliveries have a 10-second deadline and response bodies are not read or disclosed.

Legitimate private integrations require an operator to set `BOWER_NOTIFICATION_PRIVATE_URLS` to a JSON array of exact HTTPS endpoint URLs, for example `["https://notify.internal.example/hooks/deploy"]`. This is a global trust decision granting tenants permission to send deployment notifications to those endpoints, not a tenant-controlled exception. Paths and query strings must match; no origin wildcard or redirect grant exists. Normal TLS trust is still required. Existing private channels stop delivering until their exact endpoints are authorized. Prefer an egress firewall as an additional layer; address classification cannot identify public addresses routed internally by unusual network configuration.

## Webhook filters

New tag filters use RE2 Unicode semantics and are limited to 512 characters. Matching is linear-time rather than JavaScript backtracking. Ordinary anchors, groups, alternation and character classes remain supported. Lookaround, backreferences and other RE2-incompatible syntax are rejected at creation. Existing unsupported or overlength filters fail closed (the webhook returns `ignored: true` for a tag mismatch); no native-regex fallback exists. Recreate those webhooks with RE2-compatible filters before relying on automatic deployments. No database rewrite is performed. Tags longer than 1024 characters do not match filters.

## Public request bodies and route passwords

Webhook bodies are limited to 64 KiB; deploy and route-password bodies to 8 KiB. These are byte limits for declared and streamed/chunked bodies, with a total five-second read deadline. Oversize returns 413, deadline expiration 408, and malformed input 400. Webhook HMAC signs the original bytes, including whitespace and UTF-8, before JSON decoding. Unknown/inactive webhook tokens and invalid API keys are rejected before body reads. API-key service/project authorization remains required after bounded parsing.

Route-password attempts consume the shared PostgreSQL-backed authentication admission policy with scope `route-password:<routeId>` before bcrypt. Changing route IDs cannot bypass the source/family/global limits. Password verification consumes the common four-slot password-work lease; exhaustion returns 429 with `Retry-After: 60`. `verifyPassword` owns lease release. The account security migration providing `auth_abuse_buckets` must be deployed with these changes. Source identity defaults to a shared unknown bucket unless the operator configures `BOWER_AUTH_SOURCE_HEADER` behind a trusted ingress that strips and overwrites that header and prevents direct bypass. Untrusted forwarded chains are never used.
