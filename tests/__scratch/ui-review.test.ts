/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { SpecValidator } from '../../src/generation/services/spec-validator';
import { normalizeSpec } from '../../src/generation/services/spec-normalizer';
import { buildAnchorSpec } from '../../src/ui/spec-builders/anchor';
import { buildStorySpec } from '../../src/ui/spec-builders/story';
import { buildCalendarSpec } from '../../src/ui/spec-builders/calendar';
import { buildAddFlowSpec } from '../../src/ui/spec-builders/add-flow';
import { catalog } from '../../src/ui/catalog';
import { ensureV2 } from '../../src/core/types/kas-spec-v2';
import { resolveTemplate } from '../../src/engines/template-engine';
import { detectVertical, buildSampleText } from '../../src/generation/services/sample-seeds';
import type { AnchorData } from '../../src/hooks/useAnchorData';
import type { StoryData } from '../../src/hooks/useStoryData';
import type { CalendarData } from '../../src/hooks/useCalendarData';
import type { AddFlowInput } from '../../src/ui/spec-builders/add-flow';

const originalWarn = console.warn;
beforeAll(() => { console.warn = jest.fn(); });
afterAll(() => { console.warn = originalWarn; });

// ── Sample record generation (mirrors WebSpecProvider.generateSampleRecords) ──
const SAMPLE_NAMES: Record<string, string[]> = {
  client: ['Ramesh Rao', 'Sunita Menon', 'Arun Pillai'],
  customer: ['Anjali Verma', 'Suresh Reddy', 'Meera Nair'],
  couple: ['Priya & Arjun', 'Sarah & Mike', 'Lee & Hana'],
  guest: ['Giuseppe Rossi', 'Maria Bianchi', 'Anna Bruno'],
  vendor: ['Blossom Florals', 'Stellar DJs', 'Firepit Catering'],
  property: ['412 Oak Ave', '78 Willow Ln', '1501 Bayview'],
  matter: ['Estate: Peterson', 'Divorce: Chen', 'Guardianship: Lopez'],
};

function sampleFor(entity: any, sampleText: Record<string, string[]>, count = 3) {
  const key = entity.name.toLowerCase();
  const nameList = SAMPLE_NAMES[key] || [`${entity.display_name} 1`, `${entity.display_name} 2`, `${entity.display_name} 3`];
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const rec: any = { id: i + 1 };
    for (const f of entity.fields || []) {
      const fn = f.name.toLowerCase();
      const ft = (f.type || 'text').toLowerCase();
      if (fn.includes('name')) { rec[f.name] = nameList[i % nameList.length]; continue; }
      if (fn.includes('email')) { rec[f.name] = `sample${i+1}@example.com`; continue; }
      if (fn.includes('phone')) { rec[f.name] = `+1 555 010${i}`; continue; }
      if (fn.endsWith('_id')) { rec[f.name] = (i % count) + 1; continue; }
      switch (ft) {
        case 'text': case 'string': {
          const c = sampleText[fn];
          rec[f.name] = c ? c[i % c.length] : `Sample ${f.display_name || f.name} ${i+1}`;
          break;
        }
        case 'number': case 'integer': rec[f.name] = (i+1) * 10; break;
        case 'currency': case 'money': rec[f.name] = (i+1) * 1000; break;
        case 'date': {
          const offset = i === 0 ? 0 : i * 3;
          rec[f.name] = new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
          break;
        }
        case 'datetime': {
          const dtOffset = i === 0 ? 0 : i * 3;
          const hours = 9 + i * 2;
          const dt = new Date(Date.now() + dtOffset * 86400000);
          dt.setHours(hours, 0, 0, 0);
          rec[f.name] = dt.toISOString();
          break;
        }
        case 'time': rec[f.name] = `${String(9 + i*2).padStart(2,'0')}:00`; break;
        case 'boolean': case 'toggle': rec[f.name] = i % 2 === 0; break;
        case 'choice': rec[f.name] = f.options?.[i % (f.options?.length || 1)] || 'Option 1'; break;
        case 'duration': rec[f.name] = `${30 + i*15} min`; break;
        case 'note': {
          const noteList = sampleText[fn] || sampleText.notes || sampleText.note || ['Good progress.', 'Follow up next week.', 'On track.'];
          rec[f.name] = noteList[i % noteList.length];
          break;
        }
        default: rec[f.name] = `Sample ${f.name} ${i+1}`;
      }
    }
    out.push(rec);
  }
  return out;
}

const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_D = /^\d{4}-\d{2}-\d{2}$/;
function humanizeSubtitle(v: string): string {
  if (!v) return v;
  if (ISO_DT.test(v) || ISO_D.test(v)) {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const today = new Date(); today.setHours(0,0,0,0);
    const t = new Date(d); t.setHours(0,0,0,0);
    const diff = Math.round((t.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return v;
}
function timeFromField(v: any): string {
  if (!v) return '';
  const s = String(v);
  if (ISO_DT.test(s)) {
    const d = new Date(s);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (ISO_D.test(s)) {
    const d = new Date(s); const today = new Date(); today.setHours(0,0,0,0); const t = new Date(d); t.setHours(0,0,0,0);
    const diff = Math.round((t.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return s;
}

function simulateAnchor(spec: any, sampleRecords: Record<string, any[]>) {
  const anchorEntity = spec.entities.find((e: any) => e.name === spec.anchor.entity);
  if (!anchorEntity) return null;
  const anchorRows = sampleRecords[spec.anchor.entity] || [];
  const belongsTo = (anchorEntity.relationships || []).find((r: any) => r.type === 'belongs_to');
  const joinEntityName = belongsTo?.target;
  const joinRows = joinEntityName ? (sampleRecords[joinEntityName] || []) : [];

  const cards = anchorRows.map((row: any) => {
    const related: Record<string, any> = {};
    if (belongsTo && joinEntityName) {
      const fk = row[belongsTo.foreign_key];
      const joinRow = joinRows.find((j: any) => j.id === fk);
      if (joinRow) related[joinEntityName.toLowerCase()] = joinRow;
    }
    const title = resolveTemplate(spec.anchor.card_display?.title || '', row, related);
    const subtitleRaw = resolveTemplate(spec.anchor.card_display?.subtitle || '', row, related);
    const subtitle = humanizeSubtitle(subtitleRaw);
    const timeFieldName = spec.anchor.card_display?.time_field;
    const timeRaw = timeFieldName ? row[timeFieldName] : '';
    const time = timeFromField(timeRaw);
    return { id: row.id, title, subtitle, subtitleRaw, time, timeRaw };
  });
  return { cards, anchorEntity: anchorEntity.name, belongsTo: belongsTo ? `${anchorEntity.name}.${belongsTo.foreign_key}->${belongsTo.target}` : null };
}

function simulate(spec: any) {
  const vertical = detectVertical(spec);
  const sampleText = buildSampleText(vertical);
  const sample: Record<string, any[]> = {};
  for (const e of spec.entities) sample[e.name] = sampleFor(e, sampleText);
  return { sample, vertical, anchor: simulateAnchor(spec, sample) };
}

test('full UI review for 6 generated specs', () => {
  const dir = path.resolve(__dirname, '../../.planning/generated-specs-round3');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();

  const report: any = {};

  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const specRaw = raw.data?.spec ?? raw.spec ?? raw;

    const normalized = normalizeSpec(specRaw);

    const v = SpecValidator.validate(normalized);
    const c = SpecValidator.validateWithCatalog(normalized);

    let anchorCatalogOk = false; let anchorCatalogErr: string[] = [];
    try {
      const v2 = ensureV2(normalized as any);
      const anchorEntity = normalized.entities.find((e: any) => e.name === normalized.anchor.entity);
      const firstBelongs = (anchorEntity?.relationships || []).find((r: any) => r.type === 'belongs_to');
      const joinTarget = firstBelongs?.target;

      const anchorData: AnchorData = {
        greeting: 'Good morning',
        dateLabel: 'Today',
        nextUp: 'Next: Sample · 9:00 AM',
        cards: [{
          id: 1, title: 'Sample Title', subtitle: 'Sample Subtitle', time: '9:00 AM',
          warningText: null, warnings: [], rawData: { id: 1 }, relatedData: joinTarget ? { [joinTarget.toLowerCase()]: { id: 1, name: 'Sample' } } : {},
        }],
        stats: [
          { label: 'Today', value: 3, trend: { direction: 'up', label: '+20%' } },
          { label: 'This Week', value: 12, trend: null },
        ],
        emptyMessage: normalized.anchor.empty_state?.message || 'No items',
        emptyAction: normalized.anchor.empty_state?.action || null,
      };
      const spec = buildAnchorSpec(anchorData, v2 as any);
      const res = catalog.validate(spec);
      anchorCatalogOk = res.success;
      if (!res.success) anchorCatalogErr = (res.error?.issues || []).map((i: any) => `${i.path?.join('.') || '?'}: ${i.message}`);
    } catch (e: any) { anchorCatalogErr = [String(e?.message || e)]; }

    let storyCatalogOk = false; let storyCatalogErr: string[] = [];
    try {
      const firstEntity = normalized.entities[0];
      const storyData: StoryData = {
        entity: { id: 1, name: 'Sample' },
        entityType: firstEntity.name,
        entityDef: firstEntity as any,
        statsCard: [{ label: 'Total', value: '1' }],
        comingUp: [],
        events: [],
        origin: 'Created recently',
        context: firstEntity.display_name,
        warnings: [], hasMore: false, totalLoaded: 0,
      };
      const spec = buildStorySpec(storyData);
      const res = catalog.validate(spec);
      storyCatalogOk = res.success;
      if (!res.success) storyCatalogErr = (res.error?.issues || []).map((i: any) => `${i.path?.join('.') || '?'}: ${i.message}`);
    } catch (e: any) { storyCatalogErr = [String(e?.message || e)]; }

    let calendarCatalogOk = false; let calendarCatalogErr: string[] = [];
    try {
      const v2 = ensureV2(normalized as any);
      const calendarData: CalendarData = {
        year: 2026, month: 4,
        events: {}, selectedDate: null, selectedEvents: [],
        prevMonth: () => {}, nextMonth: () => {}, selectDate: () => {},
      };
      const spec = buildCalendarSpec(calendarData, v2 as any);
      const res = catalog.validate(spec);
      calendarCatalogOk = res.success;
      if (!res.success) calendarCatalogErr = (res.error?.issues || []).map((i: any) => `${i.path?.join('.') || '?'}: ${i.message}`);
    } catch (e: any) { calendarCatalogErr = [String(e?.message || e)]; }

    const sim = simulate(normalized);

    // Additional bug flags
    const findings: string[] = [];
    const ad = normalized.anchor;
    const ae = normalized.entities.find((e: any) => e.name === ad.entity);
    const fieldMap = new Map<string, string>((ae?.fields || []).map((x: any) => [x.name, x.type]));

    // Subtitle == time_field (same field)
    if (ad.card_display?.subtitle && ad.card_display?.time_field) {
      // Extract the bare field name from {foo} or {foo.bar}
      const subtitleField = ad.card_display.subtitle.replace(/[{}]/g, '').split('.')[0];
      if (subtitleField === ad.card_display.time_field) {
        findings.push(`BUG: subtitle "${ad.card_display.subtitle}" points at same field as time_field "${ad.card_display.time_field}"`);
      }
    }
    // Subtitle field is a date/datetime — will be humanized but loses semantic subtitle info
    const subtitleFieldName = (ad.card_display?.subtitle || '').replace(/[{}]/g, '').split('.')[0];
    const subtitleFieldType = fieldMap.get(subtitleFieldName);
    if (subtitleFieldType === 'date' || subtitleFieldType === 'datetime') {
      findings.push(`INFO: subtitle renders from ${subtitleFieldType} field "${subtitleFieldName}" → humanized to day label (no real descriptive text)`);
    }
    // time_field missing or null
    if (!ad.card_display?.time_field) {
      findings.push(`BUG: anchor card_display.time_field is ${JSON.stringify(ad.card_display?.time_field)} → time column will be empty`);
    }
    // Greeting is generic
    if (ad.greeting_template === 'Good {time_of_day}') {
      findings.push(`INFO: generic greeting "Good {time_of_day}" — no vertical-specific greeting (Fix 1B/3A not triggered for custom business_type)`);
    }
    // Stats labels are generic
    const statLabels = (ad.summary?.stats || []).map((s: any) => s.label);
    if (statLabels.length && statLabels.every((l: string) => ['Today', 'This Week', 'This Month'].includes(l))) {
      findings.push(`INFO: stats are generic "${statLabels.join(' / ')}" — no vertical-specific metric`);
    }
    // Cross-entity FK not shown in card
    const anchorBelongsTo = (ae?.relationships || []).find((r: any) => r.type === 'belongs_to');
    if (anchorBelongsTo && !(ad.card_display?.title?.includes(`${anchorBelongsTo.target.toLowerCase()}.`) || ad.card_display?.subtitle?.includes(`${anchorBelongsTo.target.toLowerCase()}.`))) {
      findings.push(`INFO: anchor belongs_to ${anchorBelongsTo.target} but neither title nor subtitle uses ${anchorBelongsTo.target.toLowerCase()}.* — cross-entity context hidden`);
    }
    // Wrong anchor entity: non-schedule entity used for day_schedule
    const scheduleFields = (ae?.fields || []).filter((x: any) => x.type === 'date' || x.type === 'datetime');
    if (ad.type === 'day_schedule' && scheduleFields.length === 0) {
      findings.push(`BUG: anchor type "day_schedule" but entity "${ae?.name}" has no date/datetime field`);
    } else if (ad.type === 'day_schedule' && scheduleFields.length > 1) {
      findings.push(`INFO: anchor "${ae?.name}" has multiple date fields (${scheduleFields.map((f:any)=>f.name).join(', ')}) — time_field "${ad.card_display?.time_field}" picks one`);
    }
    // Calendar entity differs from anchor
    if (normalized.calendar?.entity && normalized.calendar.entity !== ad.entity) {
      findings.push(`INFO: calendar_entity "${normalized.calendar.entity}" differs from anchor_entity "${ad.entity}" — user sees a different list in Calendar tab`);
    }
    // No chat commands
    if (!normalized.chat_commands || normalized.chat_commands.length === 0) {
      findings.push(`INFO: chat_commands is empty — no domain-specific quick actions`);
    }

    // story_events coverage
    const entityNames = normalized.entities.map((e: any) => e.name);
    const storyEntities = Object.keys(normalized.story_events || {});
    const missingStory = entityNames.filter((n: string) => !storyEntities.includes(n));
    if (missingStory.length) {
      findings.push(`INFO: story_events missing for: ${missingStory.join(', ')} (only ${storyEntities.join(', ')} have stories)`);
    }

    // Entity picker coverage on add_flows
    const pickerSteps: string[] = [];
    for (const [entName, flow] of Object.entries<any>(normalized.add_flows || {})) {
      for (const s of flow?.steps || []) {
        if (s.field_type === 'entity_picker') {
          pickerSteps.push(`${entName}.${s.field}→${s.entity_target}`);
        }
      }
    }
    // All belongs_to FKs should have a picker step
    const missingPickers: string[] = [];
    for (const ent of normalized.entities) {
      const flow = (normalized.add_flows || {})[ent.name];
      if (!flow) continue;
      const stepFields = new Set((flow.steps || []).map((s: any) => s.field));
      for (const rel of ent.relationships) {
        if (rel.type === 'belongs_to' && !stepFields.has(rel.foreign_key)) {
          missingPickers.push(`${ent.name}.${rel.foreign_key}`);
        }
      }
    }
    if (missingPickers.length) {
      findings.push(`BUG: belongs_to FKs without picker step: ${missingPickers.join(', ')}`);
    }

    report[f] = {
      detected_vertical: sim.vertical,
      normalized_anchor: {
        entity: normalized.anchor.entity,
        greeting: normalized.anchor.greeting_template,
        title_template: normalized.anchor.card_display?.title,
        subtitle_template: normalized.anchor.card_display?.subtitle,
        time_field: normalized.anchor.card_display?.time_field,
        stats: (normalized.anchor.summary?.stats || []).map((s: any) => s.label),
      },
      story_events_coverage: {
        total_entities: normalized.entities.length,
        entities_with_story: Object.keys(normalized.story_events || {}).length,
      },
      add_flow_picker_steps: pickerSteps,
      catalog_validation: {
        overall: c.success,
        errors: c.errors || [],
        warnings: c.warnings || [],
      },
      builder_validation: {
        anchor: { ok: anchorCatalogOk, errors: anchorCatalogErr },
        story: { ok: storyCatalogOk, errors: storyCatalogErr },
        calendar: { ok: calendarCatalogOk, errors: calendarCatalogErr },
      },
      simulated_cards: sim.anchor?.cards.map(c => ({ title: c.title, subtitle: c.subtitle, time: c.time, subtitle_raw: c.subtitleRaw, time_raw: c.timeRaw })),
      belongs_to: sim.anchor?.belongsTo,
      findings,
    };
  }

  fs.writeFileSync(path.resolve(__dirname, '../../.planning/generated-specs-round3/_ui-review-report.json'), JSON.stringify(report, null, 2));
  for (const [f, r] of Object.entries<any>(report)) {
    console.log(`\n=== ${f} ===`);
    console.log('  anchor:', r.normalized_anchor);
    console.log('  catalog_validation.success:', r.catalog_validation.overall);
    if (r.catalog_validation.errors.length) console.log('  catalog errors:', r.catalog_validation.errors);
    if (r.catalog_validation.warnings.length) console.log('  catalog warnings:', r.catalog_validation.warnings.slice(0, 5));
    console.log('  builder catalog.validate — anchor:', r.builder_validation.anchor.ok, 'story:', r.builder_validation.story.ok, 'calendar:', r.builder_validation.calendar.ok);
    if (!r.builder_validation.anchor.ok) console.log('    anchor errors:', r.builder_validation.anchor.errors.slice(0,3));
    if (!r.builder_validation.story.ok) console.log('    story errors:', r.builder_validation.story.errors.slice(0,3));
    if (!r.builder_validation.calendar.ok) console.log('    calendar errors:', r.builder_validation.calendar.errors.slice(0,3));
    console.log('  simulated cards:');
    for (const c of r.simulated_cards || []) console.log(`    • title="${c.title}" | subtitle="${c.subtitle}" (raw="${c.subtitle_raw}") | time="${c.time}"`);
    console.log('  findings:');
    for (const x of r.findings) console.log(`    - ${x}`);
  }

  expect(Object.keys(report).length).toBe(6);
});
