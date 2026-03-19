# KAS App TODOs

## Engineering

### Constitution Files (Pre-Wave 1)
**What:** Create architecture constitution files before starting Wave 1 implementation
**Why:** Required by agentic bridge (MVP-BRIDGE-TO-AGENTIC-PATTERNS.md) to enable production-grade governance without refactoring later
**Pros:** CI enforcement from day 1, version lineage tracking, migration safety
**Cons:** ~15 min upfront work
**Context:** Files to create:
- `architecture/constitution/spec-contract.schema.json` — Canonical spec validator
- `architecture/constitution/block-boundaries.yaml` — Block 2/3 dependency rules
- `architecture/constitution/migration-policy.yaml` — Additive-only constraints
- `architecture/constitution/agent-policy.yaml` — Change classes S/M/I/R
- `tools/constitution-compiler/compile.ts` — Generates lint rules, validators
- `governance/taste-ledger.md` — Review comment → tooling promotion
**Depends on:** Nothing — do before Wave 1 execution
**Added:** 2026-03-19 via /plan-eng-review

### CI Jobs (Wave 1)
**What:** Add validate:spec and check:migration-safety CI jobs
**Why:** Enforce spec contract and migration safety from first commit
**Pros:** Catches spec violations early, prevents destructive migrations
**Cons:** CI setup time (~10 min)
**Context:** Jobs run on every PR. Block merge if validation fails.
**Depends on:** Constitution files must exist first
**Added:** 2026-03-19 via /plan-eng-review

## Design

### Empty State Illustrations
**What:** Create warm, human illustrations for empty states (no classes today, no students yet, no search results)
**Why:** Empty states are features, not afterthoughts. Illustrations make the app feel human, not clinical.
**Pros:** Differentiates from generic SaaS, supports "Liquid Story" philosophy, improves first-time user experience
**Cons:** Requires illustration work (can use AI-generated or simple line art for MVP)
**Context:** DESIGN.md specifies empty state structure (illustration + message + action + context) but doesn't have actual illustrations yet
**Depends on:** None — can be done in parallel with Wave 1 implementation
**Added:** 2026-03-19 via /plan-design-review
