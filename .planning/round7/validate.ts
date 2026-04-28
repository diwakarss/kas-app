/**
 * Round-7 validation harness.
 * Adds Gap-4 / Gap-5 verification: did the LLM emit Service/Package/Property entities?
 */
import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../../src/generation/services/spec-validator';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';
import { detectVertical, buildSampleText } from '../../src/generation/services/sample-seeds';

const SPECS_DIR = '.planning/round7/specs';

const SERVICE_ENTITY_RE = /(service|package|menu|pricebook|treatment|offering)/i;
const LOCATION_ENTITY_RE = /(property|location|home|site|address|residence|venue|premise)/i;

type Row = {
  slug: string;
  name: string;
  specId: string | null;
  vertical: string;
  entities: string[];
  hasServiceEntity: boolean;
  hasLocationEntity: boolean;
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
    rows.push({ slug, name: slug, specId: null, vertical: '?', entities: [], hasServiceEntity: false, hasLocationEntity: false, chatCommands: 0, addFlows: 0, valid: false, errors: ['no spec.entities'], warnings: [], url: '—' });
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

  const entityNames: string[] = (normalized.entities || []).map((e: any) => e.name);
  const hasServiceEntity = entityNames.some(n => SERVICE_ENTITY_RE.test(n));
  const hasLocationEntity = entityNames.some(n => LOCATION_ENTITY_RE.test(n));
  const addFlows = normalized?.ui_hints?.add_flows ?? normalized?.add_flows ?? {};

  rows.push({
    slug,
    name: normalized?.meta?.name ?? slug,
    specId,
    vertical: detectVertical(normalized),
    entities: entityNames,
    hasServiceEntity,
    hasLocationEntity,
    chatCommands: (normalized?.chat_commands || []).length,
    addFlows: Object.keys(addFlows).length,
    valid: errors.length === 0,
    errors,
    warnings,
    url: specId ? `http://localhost:8081/?spec_id=${specId}` : '—',
  });
}

console.log('\n================ ROUND 7 VALIDATION ================\n');
console.log('SLUG'.padEnd(20), 'VERTICAL'.padEnd(18), 'ENTITIES', '  ', 'SVC', 'LOC', 'VALID');
console.log('-'.repeat(110));
for (const r of rows) {
  console.log(
    r.slug.padEnd(20),
    r.vertical.padEnd(18),
    r.entities.join(',').slice(0, 50).padEnd(52),
    r.hasServiceEntity ? '✓ ' : '· ',
    r.hasLocationEntity ? '✓ ' : '· ',
    r.valid ? 'YES' : 'NO',
  );
}
console.log('\n================ PREVIEW URLS ================');
for (const r of rows) {
  console.log(`${r.slug.padEnd(20)} → ${r.url}`);
}

console.log('\n================ GAP 4/5 SCORECARD ================');
const expectsService = ['hair-salon-v2', 'music-school-v2', 'beauty-spa', 'dental-practice'];
const expectsLocation = ['house-cleaning-v2', 'landscaping-v2', 'plumber', 'dog-walker'];
console.log('\nGap 4 — Service entity expected:');
for (const slug of expectsService) {
  const r = rows.find(x => x.slug === slug);
  console.log(`  ${slug.padEnd(20)}: ${r?.hasServiceEntity ? '✓ has Service' : '✗ MISSING'} (entities: ${r?.entities.join(',')})`);
}
console.log('\nGap 5 — Location entity expected:');
for (const slug of expectsLocation) {
  const r = rows.find(x => x.slug === slug);
  console.log(`  ${slug.padEnd(20)}: ${r?.hasLocationEntity ? '✓ has Location' : '✗ MISSING'} (entities: ${r?.entities.join(',')})`);
}

for (const r of rows) {
  if (r.errors.length) {
    console.log(`\n[${r.slug}] ERRORS:`);
    r.errors.slice(0, 4).forEach(e => console.log(`  - ${e}`));
  }
}

fs.writeFileSync('.planning/round7/report.json', JSON.stringify(rows, null, 2));
console.log(`\nWrote .planning/round7/report.json`);
