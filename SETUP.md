# Local setup guide

Step-by-step instructions to get this repo running end-to-end on a fresh
machine. By the end you'll have:

- The Expo web app running at `http://localhost:8081`
- The InsForge backend (database + edge functions) running on Docker
- The InsForge admin dashboard at `http://localhost:7131`
- The full test suite passing
- The ability to generate fresh app specs via the LLM and preview them

Estimated time: **30–45 minutes** the first time, ~2 minutes on subsequent runs.

---

## 0. Prerequisites

Install these once. macOS commands shown — adapt for your OS.

| Tool | Min version | Install |
|------|-------------|---------|
| Git | any recent | usually pre-installed |
| Docker Desktop | 20+ | https://www.docker.com/products/docker-desktop/ |
| Node.js | 20+ | `brew install node` (or use `fnm` / `nvm`) |
| Bun | 1.3+ | `brew install oven-sh/bun/bun` |

**Windows users:** the rest of this guide assumes a bash-compatible
shell because the helper scripts under `scripts/` are bash. Easiest path:

- Install **WSL2** (Ubuntu) — Docker Desktop on Windows already requires
  it. Run all commands inside the WSL terminal. Docker Desktop bridges
  the WSL distro to the host, so `localhost:7130` etc. work the same.
- **Or**, use **Git Bash** (ships with Git for Windows) for the bash
  scripts, and PowerShell for Docker / Node / Bun. Same end result,
  slightly more shell-juggling.

The PowerShell-only path requires rewriting `scripts/*.sh` and
`scripts/encrypt-secret.mjs` invocations as `.ps1` — not done yet.

Verify:

```bash
git --version
docker --version
node --version    # v20.x or higher
bun --version     # 1.3.x or higher
```

You'll also need a **DeepInfra API key** (for LLM-powered spec generation).
Ask the team lead — it's not committed to the repo. The key looks like a
32-character random string.

---

## 1. Clone both repos

The frontend app and the backend live in **two separate repos**. Clone
them into a sibling layout so paths line up with what the team uses.

```bash
mkdir -p ~/code/peoplenet
cd ~/code/peoplenet

# Frontend / app — this repo
git clone https://github.com/diwakarss/kas-app.git
# Backend — InsForge
git clone https://github.com/InsForge/InsForge.git insforge-repo
```

After this, you should have:

```
~/code/peoplenet/
├── kas-app/         ← the React Native / Expo app (this repo)
└── insforge-repo/   ← the backend (Postgres, edge functions, dashboard)
```

---

## 2. Start the backend (InsForge)

The backend is a docker-compose stack: Postgres, PostgREST, the InsForge
Node API, the dashboard SPA, and a Deno runtime for edge functions
(spec generation lives there).

### 2a. Configure environment

```bash
cd ~/code/peoplenet/insforge-repo
cp .env.example .env  # if .env doesn't exist yet
```

Open `.env` and confirm/add these lines (defaults are fine for local
development; do not use them in production):

```
JWT_SECRET=your-secret-key-here-must-be-32-char-or-above
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
WORKER_TIMEOUT_MS=300000
```

`WORKER_TIMEOUT_MS=300000` is important — the default is 60s, and LLM spec
generation often takes 90–150s, so without this you'll hit `Function timeout`
errors.

### 2b. Bring up the stack

```bash
docker compose up -d
```

First boot pulls and builds images (~5–10 minutes). Subsequent boots are
~30 seconds.

Verify all five services are healthy:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

You should see:

Names vary by Docker Compose version — older versions show `insforge-deno`,
newer ones show `insforge-deno-1`. Both work, just match the pattern:

```
insforge-postgres(-1)    Up (healthy)    # the database
insforge(-1)             Up              # the InsForge backend API
insforge-postgrest(-1)   Up              # PostgREST (REST over Postgres)
insforge-deno(-1)        Up              # Deno runtime for edge functions
insforge-vector(-1)      Up              # optional, vector embeddings
```

`insforge-vector` is optional; spec generation doesn't need it. Four
running containers (without vector) is a healthy stack for our use.

If `insforge` shows `restarting`, give it 30–60 seconds — it waits for
postgres to be healthy before it migrates.

### 2c. Deploy the edge functions

A fresh InsForge install does **not** auto-load any edge functions —
`functions.definitions` is empty until you deploy them via the admin API.
The kas-app preview pipeline needs two functions: `generate-spec` (LLM
spec generation) and `get-spec` (fetch a stored spec by id). The source
lives in your `insforge-repo` clone at `functions/examples/`.

This repo ships a deploy script that logs in as admin and uploads both
functions. It reads the JS source straight from the running Deno
container (which has `insforge-repo/functions/examples/` mounted into
it via docker-compose), so it works regardless of where you cloned
`insforge-repo` on disk. From the kas-app repo root:

```bash
bash scripts/deploy-insforge-functions.sh
```

(If for some reason the Deno container isn't running yet, you can fall
back to `INSFORGE_REPO=/path/to/your/insforge-repo bash scripts/deploy-insforge-functions.sh`,
but normally `docker compose up -d` from step 2b is enough.)

You should see:

```
→ Logging in as admin@example.com...
  got token (...)
→ Deploying 'generate-spec' ...
  created 'generate-spec' (HTTP 201)
→ Deploying 'get-spec' ...
  created 'get-spec' (HTTP 201)

→ Final state of functions.definitions:
     slug      | status | code_bytes | deployed_at
 generate-spec | active |      18609 | ...
 get-spec      | active |       3751 | ...
```

The script is idempotent — running it again will `PUT` updates instead
of failing on duplicates. Use it whenever the team updates either
function's source in `insforge-repo`.

After this, the InsForge admin dashboard's **Functions** tab will show
both rows.

### 2d. Install the DeepInfra API key into the secrets store

The spec generator function reads `DEEPINFRA_API_KEY` from a row in the
encrypted `system.secrets` table. The default install seeds a placeholder
that won't decrypt; replace it with the real key.

```bash
cd ~/code/peoplenet/kas-app

# Discover the actual container names (they vary by Compose version:
# `insforge-postgres` vs `insforge-postgres-1`).
PG=$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])postgres([-_][0-9]+)?$' | head -1)
DENO=$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])deno([-_][0-9]+)?$' | head -1)
echo "Postgres: $PG"
echo "Deno:     $DENO"

# Replace YOUR_KEY_HERE with the actual DeepInfra key
KEY="YOUR_KEY_HERE"
CIPHER=$(node scripts/encrypt-secret.mjs "$KEY")
docker exec "$PG" psql -U postgres -d insforge -c \
  "UPDATE system.secrets SET value_ciphertext = '$CIPHER', is_active = true, updated_at = NOW() WHERE key = 'DEEPINFRA_API_KEY';"
```

Expected output: `UPDATE 1`.

If the row doesn't exist (`UPDATE 0`), insert it:

```bash
docker exec "$PG" psql -U postgres -d insforge -c \
  "INSERT INTO system.secrets (key, value_ciphertext, is_active) VALUES ('DEEPINFRA_API_KEY', '$CIPHER', true);"
```

Restart the Deno runtime so it picks up the new secret on next request:

```bash
docker restart "$DENO"
```

### 2e. Smoke-test the backend

```bash
curl -s -m 60 -X POST http://localhost:7133/generate-spec \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Test","business_description":"a quick smoke test"}' \
  | head -c 200
```

You should see JSON starting with `{"success":true,"data":{"specId":"...`.

If you see `{"error":"Function not found or not active"}`, redo step 2c
(deploy script). If you see `{"error":"DEEPINFRA_API_KEY not configured"}`,
redo step 2d (secret install).

### 2f. Open the admin dashboard

http://localhost:7131/dashboard/login

Log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`. From
here you can browse tables (`spec_version`, `generation_run`, `app_instance`),
view edge functions, and inspect logs.

---

## 3. Run the frontend app

```bash
cd ~/code/peoplenet/kas-app
bun install
bun run web
```

The Expo dev server boots and prints a URL (default
**http://localhost:8081**). Open it in any browser.

The app starts on the Anchor screen with a sample template (the tutor
preset). Tap a card to see the Story screen, the **Calendar** button to
see the month view, the **+** button for the AddFlow, and the **Chat**
button for the inferred chat commands.

---

## 4. Preview a generated spec end-to-end

This is the loop the team iterates on most.

### 4a. Generate a spec via the API

```bash
curl -s -m 240 -X POST http://localhost:7133/generate-spec \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Acme Pet Grooming","business_description":"a mobile pet grooming service that visits customer homes"}' \
  -o /tmp/acme.json

# Pull out the spec_id
node -e "console.log(require('/tmp/acme.json').data.specId)"
```

This takes ~90–150 seconds (the LLM is doing real work). The output gives
you a UUID like `9e086ebf-ae9f-4305-8be4-f58dcc5e25fc`.

### 4b. Render it in the app

Open this URL, replacing the UUID with yours:

```
http://localhost:8081/?spec_id=9e086ebf-ae9f-4305-8be4-f58dcc5e25fc
```

The app fetches the spec from the backend, runs it through the
normalizer + validator, and renders it. You'll see a "Preview Mode"
banner at the top so it's clear this is a generated spec, not a real
production app.

### 4c. Or: use the existing test specs

The repo ships with 20 generated specs in `.planning/round6/specs/` and
`.planning/round7/specs/`. To preview one without regenerating, run the
validation harness which prints all the live URLs:

```bash
bun run .planning/round7/validate.ts
```

Look for the `PREVIEW URLS` section. Open any of those URLs while both
the frontend (`bun run web`) and backend (`docker compose up`) are running.

---

## 5. Run the test suite

```bash
bun test
```

Expected: ~770 tests, ~10 known pre-existing failures (chai missing in a
foundation submodule, formula-parser export issue — unrelated to app
code). All `tests/generation/*`, `tests/ui/*`, `tests/hooks/*` should
pass cleanly.

To run a single file or folder:

```bash
bun test tests/ui/spec-builders/calendar.test.ts
bun test tests/generation/
```

For type-checking and linting:

```bash
bun run typecheck
bun run lint
```

---

## 6. Working on UI / design changes

The Expo dev server hot-reloads on file save. Most changes flow through:

- **Components**: `src/components/`
- **Screens**: `src/screens/`
- **Theme tokens (colors, shadows, fonts)**: `src/core/theme/tokens.ts`
- **Design system reference**: `docs/DESIGN.md`

For visual spec changes (what each json-render component does), see:

- `src/ui/registry.tsx` — maps spec types to React components
- `src/ui/catalog.ts` — zod schemas validating each component's props
- `src/ui/spec-builders/` — converts hook data into json-render specs

Tailwind classes work via NativeWind. Class names like `bg-dawn`,
`text-clay`, `text-stream` map to the brand palette in `tokens.ts`.

---

## 7. Common issues

**`{"error":"Function not found or not active"}` from `/generate-spec`**
The edge functions weren't deployed (or got dropped after a postgres
volume reset). Re-run `bash scripts/deploy-insforge-functions.sh`.

**`{"error":"Function timeout"}` from `/generate-spec`**
You forgot `WORKER_TIMEOUT_MS=300000` in `insforge-repo/.env`. Set it,
then `docker compose up -d --force-recreate deno` to apply.

**`{"error":"DEEPINFRA_API_KEY not configured"}`**
Step 2d didn't take or the encryption key changed. Re-run 2d, then
restart the deno container (find its name via
`docker ps --format '{{.Names}}' | grep deno`).

**Postgres connection refused inside the deno container**
Almost always means the postgres container isn't running.
`docker compose up -d postgres` and wait for healthy.

**Port 8081 in use**
Another Expo or Metro instance. Kill it: `lsof -i :8081` then
`kill <pid>`. Or set `EXPO_PUBLIC_API_URL` and start on a different port.

**Web preview shows "Preview unavailable / Failed to fetch"**
Backend is down or wrong URL. The app expects
`http://localhost:7133` for the InsForge edge functions. Check
`docker ps` shows a deno container running.

**Tests fail with "Cannot find package 'chai'"**
Pre-existing in a foundation submodule, not blocking. Ignore — it's not
your code.

**Sample data shows times like "3:30 AM" or "First item in the list"**
You're running an outdated branch. `git pull origin master` — these
were fixed in commits `8600eb0` / `1c543f2` / `4497695`.

---

## 8. Workflow tips for design / non-AI workflow

Since you're working without AI assist:

- **Document changes in `docs/DESIGN.md`** when you alter the design
  system (palette, spacing, typography). This is the source of truth.
- **Add stories before commits**: when introducing a new component,
  add a test in `tests/components/` or a builder test in
  `tests/ui/spec-builders/`.
- **Use the validation harness as your QA loop**: after touching any
  spec-rendering code, run `bun run .planning/round7/validate.ts` to
  confirm all 10 generated specs still validate.
- **The `CHANGELOG.md` is hand-edited** — follow the existing format
  when shipping noticeable changes.

---

## 9. Quick reference

```bash
# Everything is up
cd ~/code/peoplenet/kas-app && bun run web        # → :8081
cd ~/code/peoplenet/insforge-repo && docker compose up -d   # → :7130, :7131, :7133

# Useful URLs
http://localhost:8081/                    # Expo app (default tutor preset)
http://localhost:8081/?spec_id=<uuid>     # Render a generated spec
http://localhost:7131/dashboard/login     # InsForge admin
http://localhost:7133/generate-spec       # POST endpoint for generation
http://localhost:7133/get-spec?id=<uuid>  # GET endpoint for stored specs

# Useful commands
bun test                                  # Test suite
bun run typecheck                         # TypeScript check
bun run .planning/round7/validate.ts      # Validate all 10 generated specs
docker compose down                       # Stop backend
docker compose up -d                      # Start backend
docker logs --tail 50 $(docker ps --format '{{.Names}}' | grep deno | head -1)   # Edge function logs
```

If anything in this guide is wrong or out of date, edit it and open a PR.
The team's job is to keep onboarding short.
