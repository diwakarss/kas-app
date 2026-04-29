#!/usr/bin/env bash
# Deploy the InsForge edge functions (generate-spec, get-spec) from the
# example .js files into a fresh InsForge install.
#
# A fresh `docker compose up` doesn't auto-load functions — they live as
# rows in `functions.definitions` that have to be inserted via the admin
# API. This script logs in, uploads each function, and verifies status.
#
# Usage:
#   INSFORGE_REPO=~/code/peoplenet/insforge-repo ./scripts/deploy-insforge-functions.sh
# Optional env:
#   ADMIN_EMAIL=admin@example.com
#   ADMIN_PASSWORD=change-this-password
#   API=http://localhost:7130

set -euo pipefail

API="${API:-http://localhost:7130}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-this-password}"
INSFORGE_REPO="${INSFORGE_REPO:-$HOME/code/peoplenet/insforge-repo}"
FN_DIR="$INSFORGE_REPO/functions/examples"

if [ ! -d "$FN_DIR" ]; then
  echo "Error: $FN_DIR not found." >&2
  echo "Set INSFORGE_REPO to the path of your insforge-repo clone." >&2
  exit 1
fi

# Login → get admin access token
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

# Deploy a single function file
deploy_fn() {
  local file="$1"
  local slug
  slug=$(basename "$file" .js)
  echo "→ Deploying '$slug' from $file..."

  # Build payload as JSON, embedding the JS source as a string.
  local payload
  payload=$(node -e '
    const fs = require("fs");
    const code = fs.readFileSync(process.argv[1], "utf8");
    const slug = process.argv[2];
    process.stdout.write(JSON.stringify({
      name: slug,
      slug,
      code,
      description: `Deployed from ${slug}.js`,
      status: "active",
    }));
  ' "$file" "$slug")

  # Try create first (POST). If slug already exists, upgrade via PUT.
  local response status
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

  # Likely 409 (already exists) — update via PUT
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

# Deploy the two functions the kas-app preview pipeline needs.
# generate-spec runs LLM-powered spec generation.
# get-spec serves stored specs back to the app via spec_id.
for slug in generate-spec get-spec; do
  if [ ! -f "$FN_DIR/$slug.js" ]; then
    echo "Error: $FN_DIR/$slug.js missing" >&2
    exit 1
  fi
  deploy_fn "$FN_DIR/$slug.js"
done

# Verify
echo ""
echo "→ Final state of functions.definitions:"
docker exec insforge-postgres psql -U postgres -d insforge -c \
  "SELECT slug, status, length(code) AS code_bytes, deployed_at FROM functions.definitions ORDER BY slug;"

echo ""
echo "✓ Done. Smoke-test with:"
echo "  curl -s -m 60 -X POST http://localhost:7133/generate-spec \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"business_name\":\"Test\",\"business_description\":\"smoke\"}' | head -c 200"
