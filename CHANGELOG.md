# Changelog

All notable changes to this project will be documented in this file.

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
