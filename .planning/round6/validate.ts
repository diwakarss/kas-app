/**
 * Round-6 validation harness.
 * Runs normalizeSpec + SpecValidator against every .json in .planning/round6/specs/
 * Prints a table of pass/fail + preview URLs.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../../src/generation/services/spec-validator';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';

const SPECS_DIR = '.planning/round6/specs';

type Row = {
  slug: string;
  name: string;
  specId: string | null;
  entities: number;
  chatCommands: number;
  addFlows: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  url: string;
};

const rows: Row[] = [];
for (const f of fs.readdirSync(SPECS_DIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  const raw = JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf8'));
  const specId = raw?.data?.specId ?? raw?.specId ?? raw?.data?.spec_id ?? null;
  const spec = raw?.data?.spec ?? raw?.spec ?? raw;

  if (!spec?.entities) {
    rows.push({ slug, name: slug, specId: null, entities: 0, chatCommands: 0, addFlows: 0, valid: false, errors: ['no spec.entities'], warnings: [], url: '—' });
    continue;
  }

  let normalized: any;
  let errors: string[] = [];
  let warnings: string[] = [];
  try {
    normalized = normalizeSpec(spec);
  } catch (e: any) {
    errors.push(`normalizeSpec threw: ${e?.message || e}`);
    normalized = spec;
  }

  try {
    const result = SpecValidator.validate(normalized);
    if (!result.valid) errors.push(...(result.errors || []).map((e: any) => typeof e === 'string' ? e : e.message || JSON.stringify(e)));
    warnings.push(...(result.warnings || []).map((w: any) => typeof w === 'string' ? w : w.message || JSON.stringify(w)));
  } catch (e: any) {
    errors.push(`validator threw: ${e?.message || e}`);
  }

  const addFlows = normalized?.ui_hints?.add_flows ?? normalized?.add_flows ?? {};
  rows.push({
    slug,
    name: normalized?.meta?.name ?? slug,
    specId,
    entities: (normalized.entities || []).length,
    chatCommands: (normalized?.chat_commands || []).length,
    addFlows: Object.keys(addFlows).length,
    valid: errors.length === 0,
    errors,
    warnings,
    url: specId ? `http://localhost:8081/?spec_id=${specId}` : '—',
  });
}

// Print table
console.log('\n================ ROUND 6 VALIDATION ================\n');
console.log('SLUG'.padEnd(18), 'NAME'.padEnd(26), 'ENT', 'CMD', 'ADD', 'VALID', 'SPEC_ID');
console.log('-'.repeat(100));
for (const r of rows) {
  console.log(
    r.slug.padEnd(18),
    (r.name || '').slice(0, 25).padEnd(26),
    String(r.entities).padStart(3),
    String(r.chatCommands).padStart(3),
    String(r.addFlows).padStart(3),
    (r.valid ? 'YES ' : 'NO  '),
    r.specId || '—'
  );
}
console.log();
console.log('================ PREVIEW URLS ================');
for (const r of rows) {
  console.log(`${r.slug.padEnd(18)} → ${r.url}`);
}
console.log();
for (const r of rows) {
  if (r.errors.length) {
    console.log(`\n[${r.slug}] ERRORS:`);
    r.errors.slice(0, 6).forEach(e => console.log(`  - ${e}`));
  }
  if (r.warnings.length) {
    console.log(`[${r.slug}] WARNINGS (${r.warnings.length}):`);
    r.warnings.slice(0, 3).forEach(w => console.log(`  - ${w}`));
  }
}

fs.writeFileSync('.planning/round6/report.json', JSON.stringify(rows, null, 2));
console.log(`\nWrote .planning/round6/report.json`);
