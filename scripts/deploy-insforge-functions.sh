#!/usr/bin/env bash
# Deploy the InsForge edge functions (generate-spec, get-spec) into a
# fresh InsForge install.
#
# A fresh `docker compose up` doesn't auto-load functions — they live as
# rows in `functions.definitions` that have to be inserted via the admin
# API. This script logs in, uploads each function, and verifies status.
#
# By default it reads the JS source from the running Deno container
# (which has `insforge-repo/functions/examples/` mounted at
# `/app/functions/examples/`). That means it works regardless of where
# the dev cloned `insforge-repo` on disk — only requirement is that the
# InsForge stack is running (`docker compose up -d`).
#
# Usage:
#   ./scripts/deploy-insforge-functions.sh
#
# Optional env:
#   ADMIN_EMAIL=admin@example.com
#   ADMIN_PASSWORD=change-this-password
#   API=http://localhost:7130
#   DENO_CONTAINER=insforge-deno
#   INSFORGE_REPO=/path/to/insforge-repo   # fallback if container not running

set -euo pipefail

API="${API:-http://localhost:7130}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-this-password}"

# ── Discover container names ──────────────────────────────────────────
# Docker Compose names containers as either `<service>` (when
# container_name: is set in compose.yml) or `<project>-<service>-1`
# (the default v2 pattern). InsForge versions vary, so match by
# pattern instead of hardcoding.
find_container() {
  local pattern="$1"
  docker ps --format '{{.Names}}' 2>/dev/null \
    | grep -E "(^|[-_])${pattern}([-_][0-9]+)?$" \
    | head -1
}

DENO_CONTAINER="${DENO_CONTAINER:-$(find_container deno)}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-$(find_container postgres)}"

# ── Locate function source ────────────────────────────────────────────
# Prefer the running container so the dev never has to set a path.
# Fall back to a local insforge-repo clone if the container is down.
SRC_MODE=""
if [ -n "$DENO_CONTAINER" ]; then
  SRC_MODE="container"
  echo "→ Reading function source from container '$DENO_CONTAINER'"
elif [ -n "${INSFORGE_REPO:-}" ] && [ -d "$INSFORGE_REPO/functions/examples" ]; then
  SRC_MODE="filesystem"
  echo "→ Reading function source from $INSFORGE_REPO/functions/examples"
else
  echo "Error: no Deno container found and INSFORGE_REPO not set." >&2
  echo "Either start the InsForge stack (cd insforge-repo && docker compose up -d)" >&2
  echo "or set INSFORGE_REPO to your local clone of insforge-repo." >&2
  echo "Tip: 'docker ps' should show a container with 'deno' in the name." >&2
  exit 1
fi
if [ -z "$POSTGRES_CONTAINER" ]; then
  echo "Warning: no Postgres container found — verification step will be skipped." >&2
fi

read_source() {
  local slug="$1"
  if [ "$SRC_MODE" = "container" ]; then
    docker exec "$DENO_CONTAINER" cat "/app/functions/examples/${slug}.js"
  else
    cat "$INSFORGE_REPO/functions/examples/${slug}.js"
  fi
}

# ── Admin login ───────────────────────────────────────────────────────
echo "→ Logging in as $ADMIN_EMAIL..."
TOKEN=$(curl -s -m 10 -X POST "$API/api/auth/admin/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(j.accessToken||"")})')

if [ -z "$TOKEN" ]; then
  echo "Error: login failed. Check ADMIN_EMAIL / ADMIN_PASSWORD." >&2
  exit 1
fi
echo "  got token (${#TOKEN} chars)"

# ── Deploy a single function ──────────────────────────────────────────
deploy_fn() {
  local slug="$1"
  echo "→ Deploying '$slug'..."

  # Pull source and build payload as JSON, embedding the JS as a string.
  local code payload
  code=$(read_source "$slug")
  if [ -z "$code" ]; then
    echo "  failed: could not read source for '$slug'" >&2
    exit 1
  fi
  payload=$(node -e '
    let buf = "";
    process.stdin.on("data", c => buf += c);
    process.stdin.on("end", () => {
      process.stdout.write(JSON.stringify({
        name: process.argv[1],
        slug: process.argv[1],
        code: buf,
        description: `Deployed from ${process.argv[1]}.js`,
        status: "active",
      }));
    });
  ' "$slug" <<< "$code")

  # Try create (POST). If slug already exists, fall back to update (PUT).
  local response status body
  response=$(curl -s -m 30 -w "\n%{http_code}" -X POST "$API/api/functions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$payload")
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "201" ] || [ "$status" = "200" ]; then
    echo "  created '$slug' (HTTP $status)"
    return
  fi

  echo "  POST returned $status — trying PUT to update..."
  response=$(curl -s -m 30 -w "\n%{http_code}" -X PUT "$API/api/functions/$slug" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$payload")
  status=$(echo "$response" | tail -n1)
  if [ "$status" = "200" ]; then
    echo "  updated '$slug' (HTTP $status)"
  else
    echo "  failed: HTTP $status" >&2
    echo "$response" | sed '$d' >&2
    exit 1
  fi
}

for slug in generate-spec get-spec; do
  deploy_fn "$slug"
done

# ── Verify ────────────────────────────────────────────────────────────
if [ -n "$POSTGRES_CONTAINER" ]; then
  echo ""
  echo "→ Final state of functions.definitions:"
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d insforge -c \
    "SELECT slug, status, length(code) AS code_bytes, deployed_at FROM functions.definitions ORDER BY slug;"
fi

echo ""
echo "✓ Done. Smoke-test with:"
echo "  curl -s -m 60 -X POST http://localhost:7133/generate-spec \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"business_name\":\"Test\",\"business_description\":\"smoke\"}' | head -c 200"
