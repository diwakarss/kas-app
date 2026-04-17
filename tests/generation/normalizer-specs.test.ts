/* eslint-disable no-console */
/**
 * Canonical-spec regression harness.
 *
 * Runs 6 real LLM-generated specs (round-3 verticals: law firm, personal chef,
 * real estate, tailor, tour guide, wedding planner) through the SpecValidator
 * + normalizer and asserts the invariants we care about holding across every
 * vertical. Writes a per-spec validation report to .planning/ as a forensic
 * artifact alongside the CI assertions.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../../src/generation/services/spec-validator';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';

const SPEC_DIR = path.resolve(__dirname, '../../.planning/generated-specs-round3');
const REPORT_PATH = path.resolve(SPEC_DIR, '_validation-report.json');

const originalLog = console.log;
const originalWarn = console.warn;
beforeAll(() => { console.log = jest.fn(); console.warn = jest.fn(); });
afterAll(() => { console.log = originalLog; console.warn = originalWarn; });

test('normalizer + validator invariants hold for canonical specs', () => {
  const files = fs.readdirSync(SPEC_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  expect(files.length).toBe(6);

  const results: Record<string, any> = {};
  const failures: string[] = [];

  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8'));
    const spec = raw.data?.spec ?? raw.spec ?? raw;

    const validation = SpecValidator.validate(spec);
    const normalized = normalizeSpec(spec);
    const normalizedValidation = SpecValidator.validate(normalized);

    const anchorBefore = spec.anchor;
    const anchorAfter = normalized.anchor;
    const diffs: string[] = [];
    if (anchorBefore?.greeting_template !== anchorAfter?.greeting_template) diffs.push(`greeting: "${anchorBefore?.greeting_template}" -> "${anchorAfter?.greeting_template}"`);
    if (anchorBefore?.card_display?.subtitle !== anchorAfter?.card_display?.subtitle) diffs.push(`subtitle: "${anchorBefore?.card_display?.subtitle}" -> "${anchorAfter?.card_display?.subtitle}"`);
    if (anchorBefore?.card_display?.time_field !== anchorAfter?.card_display?.time_field) diffs.push(`time_field: ${anchorBefore?.card_display?.time_field} -> ${anchorAfter?.card_display?.time_field}`);
    if (anchorBefore?.card_display?.title !== anchorAfter?.card_display?.title) diffs.push(`title: "${anchorBefore?.card_display?.title}" -> "${anchorAfter?.card_display?.title}"`);

    const origRels = spec.entities.flatMap((e: any) => (e.relationships || []).map((r: any) => `${e.name}.${r.foreign_key}->${r.target}`));
    const normRels = normalized.entities.flatMap((e: any) => (e.relationships || []).map((r: any) => `${e.name}.${r.foreign_key}->${r.target}`));

    results[f] = {
      validation_raw: {
        valid: validation.valid,
        structural: validation.structural_errors,
        semantic: validation.semantic_errors,
        business_logic: validation.business_logic_errors,
        injection: validation.injection_warnings,
      },
      validation_normalized: {
        valid: normalizedValidation.valid,
        structural: normalizedValidation.structural_errors,
        semantic: normalizedValidation.semantic_errors,
        business_logic: normalizedValidation.business_logic_errors,
        injection: normalizedValidation.injection_warnings,
      },
      normalization_diffs: diffs,
      relationships_added: normRels.filter((r: string) => !origRels.includes(r)),
    };

    // Normalized spec must be valid (structural + semantic + business logic).
    if (!normalizedValidation.valid) {
      failures.push(`${f}: normalized spec invalid — structural=${JSON.stringify(normalizedValidation.structural_errors)} semantic=${JSON.stringify(normalizedValidation.semantic_errors)} business=${JSON.stringify(normalizedValidation.business_logic_errors)}`);
    }
    // Normalizer must not introduce injection-pattern warnings (this is the
    // exact regression the balance_due ${…} label caused in Phase 1).
    if (normalizedValidation.injection_warnings.length > 0) {
      failures.push(`${f}: normalizer introduced injection warnings — ${JSON.stringify(normalizedValidation.injection_warnings)}`);
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

  if (failures.length > 0) {
    throw new Error(`Canonical-spec regressions:\n  - ${failures.join('\n  - ')}`);
  }
});
