import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../../src/generation/services/spec-validator';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';

test('validate round3 specs', () => {
  const dir = path.resolve(__dirname, '../../.planning/generated-specs-round3');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const results: any = {};
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const spec = raw.data?.spec ?? raw.spec ?? raw;

    const validation = SpecValidator.validate(spec);
    const normalized = normalizeSpec(spec);

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
      validation: {
        valid: validation.valid,
        structural: validation.structural_errors,
        semantic: validation.semantic_errors,
        business_logic: validation.business_logic_errors,
        injection: validation.injection_warnings,
      },
      normalization_diffs: diffs,
      relationships_added: normRels.filter((r: string) => !origRels.includes(r)),
    };
  }

  const outFile = path.resolve(__dirname, '../../.planning/generated-specs-round3/_validation-report.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  // Print summary to console
  for (const [file, r] of Object.entries<any>(results)) {
    console.log(`=== ${file} ===`);
    console.log('  valid:', r.validation.valid);
    if (r.validation.structural.length) console.log('  structural:', r.validation.structural);
    if (r.validation.semantic.length) console.log('  semantic:', r.validation.semantic);
    if (r.validation.business_logic.length) console.log('  business_logic:', r.validation.business_logic);
    if (r.normalization_diffs.length) console.log('  normalizer rewrote:', r.normalization_diffs);
    if (r.relationships_added.length) console.log('  rels inferred:', r.relationships_added);
  }

  expect(files.length).toBe(6);
});
