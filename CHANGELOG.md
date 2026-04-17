# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3.1] - 2026-04-17

### Fixed
- **Business-owner QA fixes (round 5)** — 7 end-to-end bugs across the preview app
- WebSpecProvider now normalizes fetched specs so LLM-emitted shapes flow through Phase 1-4 pipeline before render
- EntityCard `formatTime` rejects non-ISO inputs and NaN, no more `12:NaN AM` strings
- Calendar MonthGrid/DayDetail wired with proper props (`year`, `month`, `events`, `selectedDate`, `onSelectDate`) and navigate-to-Story on event press
- Anchor card tap always opens the anchor entity's Story (removed cross-ref parent swap that broke "today's jobs → tap → this job")
- Add-flow step keyboard inferred from field type and name (numeric for amounts, phone-pad for phones, email for emails)
- Optional add-flow steps default to `skip_text: 'Skip'` so users can bypass non-required fields

### Added
- `ChatOverlay` modal grouping inferred `chat_commands` by action (Add/Navigate), wired from FloatingActions chat button
- MonthGrid/DayDetail zod schemas in `ui/catalog.ts`
- `.planning/business-owner-qa-report.md` tracking the 8-fix checklist

### Changed
- `normalizeAddFlowsFormat` humanize loop enriches LLM-provided steps with keyboard + skip_text when absent

## [0.0.3.0] - 2026-03-20

### Added
- **Wave 3: Spec Generation System** — Complete LLM-powered spec generation
- Spec Library service loading 4 templates (tutor, shopkeeper, doctor, restaurant)
- Category Matcher with fuzzy matching for business type detection
- Business Identity service for injecting business name into specs
- LLM Adaptation Layer for prompt generation and response parsing
- Fresh Generator for LLM-powered spec creation (unknown business types)
- Spec Generator orchestrator with template-first + LLM fallback strategy
- LLM Provider abstraction with DeepInfra provider (Qwen-2.5-72B-Instruct)
- Extended Spec Validator with semantic checks for LLM output
- Pattern extraction tool (`tools/extract-patterns.ts`)
- Golden eval test suite (20 examples across multiple business types)
- 9 new test files with 133 tests for generation block

### Changed
- WAVE-3-GATES.md updated to reflect completion status

## [0.0.2.0] - 2026-03-20

### Added
- `restaurant` and `doctor` spec types with seed data functions
- Defensive handling for malformed story events in `useStoryData`
- Legacy add_flow format normalization (`{fields: [...]}` → `{field: ...}`)
- Default display templates for calendar and search when config is missing
- FK column generation from relationships not declared in fields array

### Changed
- Spec templates moved from `assets/*.json` to `assets/templates/*.json`
- `useSearch` uses optional chaining for display config
- Constitution compiler reads template list from `index.json`

### Fixed
- Missing semicolon in schema-engine.ts

## [0.0.1.0] - 2026-03-20

### Added
- Extended event envelope with governance tracking columns: `change_class`, `spec_version`, `policy_version`, `diff_ref`
- Migration traceability via `_schema_version` table for recording all schema changes
- `recordMigration()` function with transaction atomicity and failure recording
- `getMigrationHistory()` function to query migration records
- `layer-boundaries.yaml` constitution file defining Clean Architecture layers
- Architecture boundary enforcement via `lint:architecture` using dependency-cruiser
- `policy_version` field in spec schema and all spec files
- P3 performance gate tests (search <300ms, CI-enforced)
- Comprehensive test coverage for Wave 2 bridge work (33 new tests)

### Changed
- `logEvent()` now accepts spec parameter for version tracking
- `logEvent()` infers `change_class` from event type: created='S', updated/archived='M'
- Updated `crud-service.ts` to pass spec to logEvent calls
