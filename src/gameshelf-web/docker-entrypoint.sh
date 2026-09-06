#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts. Turns container environment
# variables into a small JS file the SPA reads at load time, so one image works in
# every environment without a rebuild.
#
#   API_BASE_URL     browser-side URL of the API ('' = same origin)
#   OKTA_ISSUER      OpenID Connect issuer; with OKTA_CLIENT_ID enables sign-in
#   OKTA_CLIENT_ID   the SPA's client id (public, PKCE — there is no client secret)
set -eu

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__GAMESHELF_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL:-}",
  oktaIssuer: "${OKTA_ISSUER:-}",
  oktaClientId: "${OKTA_CLIENT_ID:-}"
};
EOF

if [ -n "${OKTA_ISSUER:-}" ] && [ -n "${OKTA_CLIENT_ID:-}" ]; then
  auth_mode="sign-in via ${OKTA_ISSUER}"
else
  auth_mode="local mode (no identity provider)"
fi

echo "runtime-config.js written (apiBaseUrl=${API_BASE_URL:-<same-origin>}, ${auth_mode})"
