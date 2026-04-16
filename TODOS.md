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

### Empty State Illustrations
**What:** Create warm, human illustrations for empty states (no classes today, no students yet, no search results)
**Why:** Empty states are features, not afterthoughts. Illustrations make the app feel human, not clinical.
**Pros:** Differentiates from generic SaaS, supports "Liquid Story" philosophy, improves first-time user experience
**Cons:** Requires illustration work (can use AI-generated or simple line art for MVP)
**Context:** DESIGN.md specifies empty state structure (illustration + message + action + context) but doesn't have actual illustrations yet
**Depends on:** None — can be done in parallel with Wave 1 implementation
**Added:** 2026-03-19 via /plan-design-review

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
