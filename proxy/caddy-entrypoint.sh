#!/bin/sh
set -eu
config=/run/trellis-secrets/BOWER_CADDYFILE
if [ -n "${BOWER_CADDYFILE:-}" ]; then
  config="$(mktemp /tmp/bower-caddy.XXXXXX)"
  printf '%s\n' "$BOWER_CADDYFILE" > "$config"
fi
exec caddy run --config "$config" --adapter caddyfile
