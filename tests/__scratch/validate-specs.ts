import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../src/generation/services/spec-validator';
import { normalizeSpec } from '../src/generation/services/spec-normalizer';

const dir = '.planning/generated-specs-round3';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

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
  
  const origEntities = new Set(spec.entities.map((e: any) => e.name));
  const normEntities = new Set(normalized.entities.map((e: any) => e.name));
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

console.log(JSON.stringify(results, null, 2));
