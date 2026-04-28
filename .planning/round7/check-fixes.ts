/**
 * Round-6 fix verification.
 * For each round-6 spec: detect vertical, simulate the seeded `description`
 * text, and check the EntityCard time formatter against an ISO datetime.
 */
import * as fs from 'fs';
import * as path from 'path';
import { detectVertical, buildSampleText } from '../../src/generation/services/sample-seeds';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';

const SPECS_DIR = '.planning/round7/specs';

function fmtTime(isoOrTime: string): string {
  // Mirror EntityCard.formatTime / useAnchorData parse
  if (/^\d{1,2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoOrTime)) {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return isoOrTime;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return isoOrTime;
}

const rows: any[] = [];
for (const f of fs.readdirSync(SPECS_DIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  const raw = JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf8'));
  const rawSpec = raw?.data?.spec ?? raw?.spec ?? raw;
  if (!rawSpec?.entities) continue;
  const spec = normalizeSpec(rawSpec);

  const vertical = detectVertical(spec);
  const bucket = buildSampleText(vertical);

  // Simulate description seed for the activity / anchor entity
  const anchor = spec.entities.find((e: any) => e.name === spec.anchor.entity) || spec.entities[0];
  const descField = anchor.fields.find((f: any) => /^(description|notes|note|topic|service|title)$/i.test(f.name));
  const sampleDesc = descField ? bucket[descField.name.toLowerCase()]?.[0] : null;

  // Simulate setHours(9) seed → ISO with local 9am
  const dt = new Date();
  dt.setHours(9, 0, 0, 0);
  const iso = dt.toISOString();
  const displayedTime = fmtTime(iso);

  const generic = sampleDesc === 'First item in the list';
  rows.push({
    slug,
    vertical,
    anchorEntity: anchor.name,
    sampleDesc: sampleDesc ?? '(no description field)',
    generic,
    iso,
    displayedTime,
  });
}

console.log('\n=== ROUND 6 — POST-FIX SAMPLE TEXT + TIME ===\n');
console.log('SLUG'.padEnd(18), 'VERTICAL'.padEnd(18), 'SAMPLE DESC'.padEnd(40), 'TIME', 'GENERIC?');
console.log('-'.repeat(110));
for (const r of rows) {
  console.log(
    r.slug.padEnd(18),
    r.vertical.padEnd(18),
    (r.sampleDesc || '').slice(0, 38).padEnd(40),
    r.displayedTime,
    r.generic ? '⚠️ YES' : 'no',
  );
}
const stillGeneric = rows.filter(r => r.generic);
console.log(`\nStill generic: ${stillGeneric.length}/${rows.length}`);
if (stillGeneric.length) {
  console.log('Slugs needing more vertical coverage:', stillGeneric.map(r => r.slug).join(', '));
}
