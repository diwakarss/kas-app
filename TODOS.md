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

### Empty State Illustrations
**What:** Create warm, human illustrations for empty states (no classes today, no students yet, no search results)
**Why:** Empty states are features, not afterthoughts. Illustrations make the app feel human, not clinical.
**Pros:** Differentiates from generic SaaS, supports "Liquid Story" philosophy, improves first-time user experience
**Cons:** Requires illustration work (can use AI-generated or simple line art for MVP)
**Context:** DESIGN.md specifies empty state structure (illustration + message + action + context) but doesn't have actual illustrations yet
**Depends on:** None — can be done in parallel with Wave 1 implementation
**Added:** 2026-03-19 via /plan-design-review
