#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts. Turns container environment variables into
# (1) a small JS file the SPA reads at load time and (2) the response headers nginx sends, so one
# image works in every environment without a rebuild — which is what lets a slot swap promote the
# exact image that was tested.
#
#   API_BASE_URL     browser-side URL of the API ('' = same origin)
#   OKTA_ISSUER      OpenID Connect issuer; with OKTA_CLIENT_ID enables sign-in
#   OKTA_CLIENT_ID   the SPA's client id (public, PKCE — there is no client secret)
set -eu

# Values land inside JS string literals, so a quote, backslash or newline would break the file or
# inject script. App settings are operator-controlled, but a malformed value should fail visibly
# rather than produce a subtly broken page. POSIX sh and sed only: nginx:alpine has nothing else.
js() {
  printf '"%s"' "$(printf '%s' "${1-}" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

# scheme://host[:port] of a URL, or nothing for a blank or relative one.
origin() {
  printf '%s' "${1-}" | sed -n -E 's#^(https?://[^/]+).*#\1#p'
}

cat > /usr/share/nginx/html/runtime-config.js <<CONFIG
window.__GAMESHELF_CONFIG__ = {
  apiBaseUrl: $(js "${API_BASE_URL:-}"),
  oktaIssuer: $(js "${OKTA_ISSUER:-}"),
  oktaClientId: $(js "${OKTA_CLIENT_ID:-}")
};
CONFIG

# Content-Security-Policy. Two entries can only be known here, at runtime:
#   connect-src  the API's origin (when it is not same-origin) and the issuer, for discovery and the token exchange
#   frame-src    the issuer. The sign-in SDK renews tokens in a hidden iframe; without this the CSP falls back to
#                default-src 'self', blocks it, and the session dies at access-token expiry with a single console
#                message as the only clue.
api_origin="$(origin "${API_BASE_URL:-}")"
issuer_origin="$(origin "${OKTA_ISSUER:-}")"
csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
csp="$csp; connect-src 'self'${api_origin:+ $api_origin}${issuer_origin:+ $issuer_origin}"
csp="$csp; frame-src 'self'${issuer_origin:+ $issuer_origin}"
csp="$csp; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

# Included by every location in nginx.conf: add_header does not inherit into a block that declares
# its own, so each block has to pull these in explicitly or it silently sends none of them.
cat > /etc/nginx/security-headers.conf <<HEADERS
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "$csp" always;
HEADERS

if [ -n "${OKTA_ISSUER:-}" ] && [ -n "${OKTA_CLIENT_ID:-}" ]; then
  auth_mode="sign-in via ${OKTA_ISSUER}"
else
  auth_mode="local mode (no identity provider)"
fi

echo "runtime-config.js written (apiBaseUrl=${API_BASE_URL:-<same-origin>}, ${auth_mode})"
