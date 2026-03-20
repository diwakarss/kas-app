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
