# KAS App TODOs

## Engineering

### ~~Constitution Files (Pre-Wave 1)~~ ✅ DONE
**Status:** Completed 2026-03-19
**Files created:**
- `architecture/constitution/spec-contract.schema.json` — Canonical spec validator
- `architecture/constitution/block-boundaries.yaml` — Block 2/3 dependency rules
- `architecture/constitution/migration-policy.yaml` — Additive-only constraints
- `architecture/constitution/agent-policy.yaml` — Change classes S/M/I/R
- `tools/constitution-compiler/compile.ts` — Generates lint rules, validators
- `tools/constitution-compiler/validate.js` — Runtime validator
- `tools/constitution-compiler/check-migration.js` — Migration checker
- `governance/taste-ledger.md` — Review comment → tooling promotion

### ~~CI Jobs (Wave 1)~~ ✅ DONE
**Status:** Completed 2026-03-19
**Jobs configured in `.github/workflows/ci.yml`:**
- `validate-spec` — Validates spec files against schema
- `check-migration-safety` — Ensures additive-only migrations
- `lint-architecture` — Block boundary enforcement (placeholder)
**Verification:** `npm run validate:spec` and `npm run check:migration-safety` pass

### ~~Performance Verification Procedures (Wave 2)~~ ✅ DONE
**Status:** Completed 2026-03-20
**File created:** `architecture/PERFORMANCE-RUNBOOK.md`
- P1 (cold start <1000ms) verification via Expo DevTools
- P2 (scroll 60fps) verification via React DevTools Profiler
- Manual timing fallback methods
- Baseline metrics table for tracking

### ~~Prompt Engineering Guidelines (Wave 3)~~ ✅ DONE
**Status:** Completed 2026-03-20
**File created:** `architecture/PROMPT-ENGINEERING-GUIDE.md`
- System prompt architecture documentation
- Prompt engineering rules (explicit structure, negative examples, temperature selection)
- Field type reference
- Common failure modes and prevention
- Testing procedures and golden evaluation
- Model-specific notes (Qwen, OpenAI)

### ~~LLM Cost Tracking (Wave 3)~~ ✅ DONE
**Status:** Completed 2026-03-20
**Files created:**
- `src/generation/services/cost-tracker.ts` — Cost calculation and metrics logging
- `tests/generation/cost-tracker.test.ts` — 16 tests for cost tracking
**Features:**
- `calculateCost()` — Calculate cost from token usage and model pricing
- `logGenerationMetrics()` — Log generation with cost, latency, and tokens
- `getCostSummary()` — Aggregate cost summary by provider and time period
- Cost breakdown in `FreshGenerationResult.metadata`

### ~~LLM Latency Benchmarks (Wave 3)~~ ✅ DONE
**Status:** Completed 2026-03-20
**File created:** `tests/generation/latency-benchmarks.test.ts`
- Baseline latency expectations documented (P2 gate: <30s)
- Provider-specific baselines (DeepInfra fast/capable, OpenAI)
- Latency tracking via generation metrics
- Regression detection utilities
- 11 tests for latency tracking and analysis

## Design

### ~~Empty State Illustrations~~ ✅ DONE
**Status:** Completed 2026-03-20
**Files created:** `assets/illustrations/`
- `empty-no-classes.svg` — Calendar + coffee cup for "enjoy your break"
- `empty-no-students.svg` — Empty chair + graduation cap for first student
- `empty-no-results.svg` — Magnifying glass + question mark for search
- `empty-no-payments.svg` — Open wallet + coins for payment tracking
- `empty-no-notes.svg` — Notebook + pencil for note-taking
- `index.json` — Usage guide with messages and actions

**Design tokens used:** dawn, clay, mist, ember, bloom, stream
**Style:** Warm line-art, "Liquid Story" philosophy, 200x200 viewBox

### InsForge Backend Setup (Wave 4)
**Status:** Not started
**Files to create:**
- `backend/docker-compose.yml` — InsForge configuration
- `backend/schema.sql` — PostgreSQL schema (app_instance, spec_version, generation_run)
- `backend/functions/generate-spec.ts` — Edge function (Node.js mode)
**Decisions locked:**
- Edge function in InsForge (not Vercel)
- InsForge Node.js mode (full bundling)
- Server wins for sync conflicts

### API Integration Tests (Wave 4)
**Status:** Not started
**Files to create:**
- `tests/api/auth.test.ts` — Auth endpoint tests
- `tests/api/specs.test.ts` — Spec CRUD tests
- `tests/api/preview.test.ts` — Preview endpoint tests
- `tests/api/setup.ts` — Test server setup
**Coverage:** 100% of endpoints
**See:** `docs_dev/wave4-test-plan.md`

### SpecLoader Sync Tests (Wave 4)
**Status:** Not started
**Files to create:**
- `tests/sync/spec-loader.test.ts` — All 4 branches (cache hit, miss, version mismatch, offline)
- `tests/sync/migration-sync.test.ts` — Migration on sync tests
- `tests/sync/offline.test.ts` — Offline behavior tests
**Coverage:** 100% branch coverage
**See:** `docs_dev/wave4-test-plan.md`

### Auth Wrapper (Wave 4)
**Status:** Not started
**Files to create:**
- `src/services/auth.ts` — Thin wrapper around InsForge auth
- `src/screens/AuthScreen.tsx` — Login/signup UI
**Approach:** Thin wrapper, InsForge handles sessions

### Preview Performance (Wave 4)
**Status:** Not started
**Gate:** P2 preview iframe load <3s
**Mitigations:**
- Code splitting for preview mode
- Lazy load non-essential components
- Pre-generate sample data on server
- Skeleton loading states

### SSE Progress Streaming (Wave 4 — CEO Review Addition)
**Status:** Not started
**What:** Show generation progress steps ("Analyzing...", "Generating...", "Validating...")
**Why:** Makes 10-30s generation time feel faster, builds trust in the AI process
**Effort:** S (human: 2h, CC: 20 min)
**Depends on:** InsForge edge functions
**Feature flag:** ENABLE_PROGRESS_SSE

---

## Deferred (Post-Wave 4)

### QR Code for App Download
**Status:** Deferred from Wave 4 CEO review
**What:** Show QR code on preview page that opens App Store/Play Store
**Why:** Frictionless download experience, great for in-person demos to Ravi
**Effort:** S (human: 1-2h, CC: 15 min)
**Priority:** P2
**Depends on:** App store submission complete

### Template Gallery on Landing
**Status:** Deferred from Wave 4 CEO review
**What:** Show 3-4 sample apps (tutor, shopkeeper, doctor, restaurant) on landing page
**Why:** Builds immediate credibility, users can see what KAS produces before typing
**Effort:** M (human: 4h, CC: 1h)
**Priority:** P2
**Depends on:** Preview component, templates (already exist)

### Webhook on Spec Generation
**Status:** Deferred from Wave 4 CEO review
**What:** POST to configurable URL when spec is generated
**Why:** Platform foundation — enables Zapier, email notifications, CRM integrations
**Effort:** M (human: 4h, CC: 1h)
**Priority:** P3
**No blockers**
