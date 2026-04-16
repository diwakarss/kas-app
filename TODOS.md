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

### Spec Builder Default-Detection Guard (P2)
**What:** Add a prop-diff check to each spec builder's `catalog.validate()` call. After validation, compare `builtSpec.elements[key].props` against `validation.data.elements[key].props`. If they differ, a Zod default was applied — meaning the builder omitted a prop the component needs. Log a warning with the specific props that were filled in. This turns a silent production rendering bug into a test-time/dev-time error.
**Why:** `catalog.prompt()` tells the LLM that optional props have defaults. The LLM may omit them. But catalog defaults do NOT apply at runtime — `catalog.validate()` strips `on` handlers, so builders return the original spec, not the parsed output. If a builder omits a prop, the Renderer receives `undefined` and the component breaks. The current test suite doesn't catch this because `catalog.validate()` sees its own default as satisfying the schema.
**Pros:** Catches builder gaps at dev time, ~15 lines per builder, no runtime cost in production
**Cons:** Requires comparing serialized props (fragile for complex objects), may produce false positives for intentionally-omitted props
**Context:** Discovered during PR #6 rework. The `on`-handler stripping forced builders to return `builtSpec` instead of `validation.data`. This is the belt-and-suspenders hardening for that decision.
**Depends on:** PR #6 merged (validateWithCatalog + builder validation)
**Added:** 2026-04-16

### Prompt Size Monitoring (json-render Migration)
**What:** Add a test asserting `catalog.prompt().length < 8000` characters (~2000 tokens). If the prompt grows beyond this, investigate compression.
**Why:** `catalog.prompt()` with 13+ custom components + 9 actions + KAS business rules could produce a very large system prompt, increasing token cost and diluting LLM attention on business-specific instructions.
**Pros:** Catches prompt bloat early, maintains generation quality
**Cons:** Arbitrary threshold, may need tuning
**Context:** Current hand-written prompt is ~2000 chars. catalog.prompt() will be larger because it includes all component schemas. Outside voice flagged this as a risk.
**Depends on:** Phase 1 completion (catalog must exist)
**Added:** 2026-04-16 via /plan-eng-review (json-render migration)

### json-render Upgrade Cadence
**What:** Quarterly review of @json-render/core and @json-render/react-native for breaking changes, security fixes, and new features. Document upgrade process.
**Why:** Pinned to exact version 0.17.0 (pre-1.0 framework). Missing bug fixes and security patches without active monitoring.
**Pros:** Controlled upgrade path, no surprise breakage
**Cons:** Manual effort quarterly
**Context:** Outside voice flagged vendor lock risk. This is the mitigation. Review the changelog and test suite on each upgrade.
**Depends on:** Migration completion
**Added:** 2026-04-16 via /plan-eng-review (json-render migration)

### Spec Health Badge (json-render Migration)
**What:** Small UI indicator showing spec validation state: green (fully valid), yellow (valid but fields auto-repaired by Zod defaults), red (validation errors). Based on the repair-count threshold.
**Why:** Makes the repair threshold visible to users. They see "cleanly generated" vs. "needed some fixing."
**Pros:** Trust transparency, early warning for degraded generation quality
**Cons:** Arbitrary threshold display, may confuse non-technical users
**Context:** Deferred from CEO review expansion ceremony. The repair-count threshold (>30% = reject) already exists from eng review. This surfaces it visually.
**Depends on:** Migration completion (repair threshold must exist)
**Added:** 2026-04-16 via /plan-ceo-review (json-render migration)

### Spec Export/Import (json-render Migration)
**What:** Tap to export current spec as shareable JSON file. Import a spec from another user via file picker or paste. Foundation for a future template marketplace.
**Why:** Enables network effects. A plumber exports their setup, shares on a forum, another plumber imports and is running in 10 seconds.
**Pros:** Future marketplace foundation, user-to-user sharing, backup/restore capability
**Cons:** Security surface (imported specs need full validation + injection detection), premature without a sharing platform
**Context:** Deferred from CEO review expansion ceremony. No users to share with yet. Build when there's a sharing surface.
**Depends on:** Migration completion + catalog.validate() working
**Added:** 2026-04-16 via /plan-ceo-review (json-render migration)

### json-render Vendor Contingency Plan
**What:** Document the fork/rip-out contingency for @json-render if Vercel abandons it or a breaking change is incompatible with Expo. Include: fork threshold (6+ months no releases + critical bug unpatched), rip-out estimate (~2 days to revert Renderer to direct JSX while keeping catalog/spec builders), and Expo/RN compatibility test matrix for upgrades.
**Why:** Version pinning + quarterly review is passive monitoring. Active contingency planning forces you to think through worst case before it happens.
**Pros:** Clear decision framework when (not if) the dependency causes friction
**Cons:** May never be needed, documentation maintenance
**Context:** From CEO review outside voice finding. json-render is pre-1.0 (0.17.0). Quarterly upgrade cadence already tracked above.
**Depends on:** Migration completion
**Added:** 2026-04-16 via /plan-ceo-review (json-render migration)

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

### Existing Screen Design Overhaul (AnchorScreen + StoryScreen)
**What:** Redesign AnchorScreen and StoryScreen card-stack architecture. Codex outside voice hard-rejected current design: card hierarchy is flat (no visual weight difference between primary and secondary info), information density is low (large cards with little data), and timeline visualization lacks visual rhythm.
**Why:** Current screens feel like a generic CRUD list, not a "Liquid Story" experience. Users can't scan quickly.
**Pros:** Better information density, faster scanning, stronger visual hierarchy, differentiated from generic SaaS
**Cons:** Significant UI rework across 2 screens + dependent components, risk of breaking existing functionality
**Context:** Codex design voice flagged 7 issues across existing screens during json-render migration review. User chose to defer to separate effort rather than scope-creep the migration. Key issues: (1) EntityCard has no visual weight differentiation, (2) StoryScreen timeline events are uniform height/style regardless of importance, (3) StatsCard numbers lack context (no sparklines, no trend indicators), (4) Warning badges blend into card chrome instead of demanding attention, (5) SummaryStats is a flat row with no hierarchy, (6) Back button is plain text instead of a proper navigation pattern, (7) ArchiveModal uses generic confirmation pattern.
**Depends on:** json-render migration completion (screens will be rewritten during migration, redesign should happen after)
**Added:** 2026-04-16 via /plan-design-review (Codex outside voice findings)

### Styling Consistency Audit
**What:** Unify styling approach across all components. Currently mixed: AnchorScreen uses inline styles, StoryScreen uses NativeWind classNames, some components use both. Pick one approach and apply consistently.
**Why:** Mixed styling makes maintenance harder and creates visual inconsistencies (slightly different spacing, font sizing).
**Pros:** Easier maintenance, consistent visual output, faster development
**Cons:** Mechanical refactor work
**Context:** Found during design review. AnchorScreen loading/error states use inline styles while StoryScreen uses NativeWind for the same patterns. EntityCard and Greeting use pure NativeWind. Not blocking but adds friction.
**Depends on:** json-render migration completion (screens rewritten during migration should adopt consistent approach)
**Added:** 2026-04-16 via /plan-design-review

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
