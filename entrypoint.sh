#!/bin/sh
if [ -n "$TRELLIS_CA_CERT" ]; then
  printf '%s\n' "$TRELLIS_CA_CERT" > /tmp/trellis-ca.pem
  export NODE_EXTRA_CA_CERTS=/tmp/trellis-ca.pem
fi
exec node "${1:-exec/server.mjs}"
