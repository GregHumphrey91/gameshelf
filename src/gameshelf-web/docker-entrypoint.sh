#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts. Turns container environment
# variables into a small JS file the SPA reads at load time, so one image works in
# every environment without a rebuild.
set -eu

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__GAMESHELF_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL:-}"
};
EOF

echo "runtime-config.js written (apiBaseUrl=${API_BASE_URL:-<same-origin>})"
