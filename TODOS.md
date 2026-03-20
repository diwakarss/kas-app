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

### Performance Verification Procedures (Wave 2)
**What:** Document manual verification procedures for P1 (cold start <1000ms) and P2 (scroll 60fps) performance gates
**Why:** These gates cannot be CI-automated; need clear runbook for release verification
**Pros:** Ensures performance is verified before every release, creates reproducible process
**Cons:** Manual step in release process
**Context:** Wave 2 adds hard thresholds for performance. P3 (search <300ms) is CI-gated, but P1/P2 require Expo DevTools profiling on real device/simulator
**Depends on:** None
**Added:** 2026-03-19 via /plan-eng-review (Wave 2)

### Prompt Engineering Guidelines (Wave 3)
**What:** Document prompt engineering guidelines for future template authors
**Why:** As new templates are added, authors need guidance on prompt structure, expected outputs, and testing
**Pros:** Consistency across templates, faster onboarding for contributors, reduces prompt debugging
**Cons:** Needs maintenance as LLM capabilities evolve
**Context:** Wave 3 introduces LLM-powered spec generation. Prompts are code, and like code need documentation
**Depends on:** Wave 3 completion (prompts must exist first)
**Added:** 2026-03-20 via /plan-eng-review (Wave 3)

### LLM Cost Tracking (Wave 3)
**What:** Add LLM cost tracking/monitoring for generation API
**Why:** Understanding API costs is critical as usage grows; enables budgeting and optimization
**Pros:** Visibility into per-generation costs, enables cost optimization, supports usage-based pricing
**Cons:** Adds logging overhead, requires cost calculation per provider
**Context:** Wave 3 introduces LLM API calls. Each call has associated token costs that should be tracked
**Depends on:** Wave 3 completion (generation API must exist first)
**Added:** 2026-03-20 via /plan-eng-review (Wave 3)

### LLM Latency Benchmarks (Wave 3)
**What:** Performance benchmark for LLM generation (baseline latency tracking)
**Why:** Track generation latency over time to detect regressions and optimize
**Pros:** Regression detection, optimization targets, SLA documentation
**Cons:** Requires baseline establishment, adds CI time for benchmark runs
**Context:** Wave 3 generation has P2 gate (<30s). Tracking actual latency over time helps identify drift
**Depends on:** Wave 3 completion (generation must exist first)
**Added:** 2026-03-20 via /plan-eng-review (Wave 3)

## Design

### Empty State Illustrations
**What:** Create warm, human illustrations for empty states (no classes today, no students yet, no search results)
**Why:** Empty states are features, not afterthoughts. Illustrations make the app feel human, not clinical.
**Pros:** Differentiates from generic SaaS, supports "Liquid Story" philosophy, improves first-time user experience
**Cons:** Requires illustration work (can use AI-generated or simple line art for MVP)
**Context:** DESIGN.md specifies empty state structure (illustration + message + action + context) but doesn't have actual illustrations yet
**Depends on:** None — can be done in parallel with Wave 1 implementation
**Added:** 2026-03-19 via /plan-design-review
