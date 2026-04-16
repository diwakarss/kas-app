# json-render Runtime Contract

## Catalog defaults do NOT apply at render time

`catalog.validate()` uses Zod schemas that define defaults for optional component props (e.g., `iconColor.default('stream')`, `severity.default('warning')`, `subtitle.default(null)`). These defaults serve two purposes:

1. **LLM guidance** — `catalog.prompt()` tells the LLM what the defaults are, so it can omit optional props when the default is appropriate.
2. **Validation** — `catalog.validate(spec)` accepts specs with missing optional props because Zod fills in the defaults during parsing.

However, the **parsed output from `catalog.validate()` is not used at runtime**. The reason: Zod's strict parsing strips unknown keys from elements, including the `on` property that json-render uses for event handlers (button presses, navigation, etc.). Returning `validation.data` would silently break all interactive elements.

Instead, spec builders return the original `builtSpec` and use `catalog.validate()` only for drift detection (logging warnings if the spec is invalid).

## The builder contract

**Spec builders must explicitly set every prop that a component will render, including optionals.** Do not rely on catalog Zod defaults to fill in missing values — they won't reach the Renderer.

When adding a new catalog component or modifying an existing one:

1. Define the Zod schema with defaults in `src/ui/catalog.ts` (this informs the LLM).
2. In the spec builder, explicitly set every prop the component reads — even if the value matches the Zod default.
3. In the registry (`src/ui/registry.tsx`), the component implementation receives `props` directly from the spec. If a prop is `undefined`, it was never set by the builder.

## Validation pipeline

LLM-generated business specs flow through this pipeline:

```
LLM output → normalizeSpec() → validateWithCatalog() → repaired spec → store
```

- `normalizeSpec()` (from PR #4) fills structural gaps: missing arrays, null entities, field type mapping.
- `validateWithCatalog()` (from PR #6) runs existing structural/semantic/business-logic validation, then adds catalog-aware warnings.

At render time, the stored business spec flows through:

```
stored spec → ensureV2() → spec builder → catalog.validate() (warn-only) → Renderer
```

The spec builder is the last code that can set prop values before the Renderer receives them.

## Future: closing the gap

A P2 follow-up (tracked in TODOS.md) will add prop-diff detection to the builder validation step. After `catalog.validate()`, the builder will compare input props against parsed props. If they differ, a Zod default was applied — meaning the builder omitted a prop it should have set. This will surface as a warning at dev/test time.
