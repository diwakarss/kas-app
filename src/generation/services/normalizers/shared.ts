/**
 * Shared spec-normalizer helpers.
 *
 * Low-level utilities used across multiple normalizer stages: string
 * humanization, icon inference, field finders (primary/subtitle/schedule
 * date), and template validation.
 */

import type { Entity, Field } from '../../../core/types/spec';

// ── Humanization helpers ──

/** Convert snake_case or CamelCase to Title Case: "session_date" → "Session Date", "RepairOrder" → "Repair Order" */
export function humanize(name: string): string {
  return name
    .replace(/_id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Common irregular plurals */
const IRREGULAR_PLURALS: Record<string, string> = {
  Child: 'Children', Person: 'People', Man: 'Men', Woman: 'Women',
  Class: 'Classes', Address: 'Addresses', Business: 'Businesses',
  Diagnosis: 'Diagnoses', Analysis: 'Analyses', Status: 'Statuses',
  Tooth: 'Teeth', Foot: 'Feet', Goose: 'Geese', Mouse: 'Mice',
  Leaf: 'Leaves', Life: 'Lives', Wife: 'Wives', Knife: 'Knives',
  Shelf: 'Shelves', Half: 'Halves', Self: 'Selves',
  Ox: 'Oxen', Fish: 'Fish', Sheep: 'Sheep', Deer: 'Deer', Species: 'Species',
  Series: 'Series', Attendance: 'Attendance Records',
};

export function smartPlural(name: string): string {
  if (IRREGULAR_PLURALS[name]) return IRREGULAR_PLURALS[name];
  if (name.endsWith('y') && !/[aeiou]y$/i.test(name)) return name.slice(0, -1) + 'ies';
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z') || name.endsWith('ch') || name.endsWith('sh'))
    return name + 'es';
  return name + 's';
}

/** Infer emoji icon from entity name */
const ICON_MAP: Record<string, string> = {
  client: '👤', customer: '👤', patient: '🏥', owner: '👤', parent: '👪',
  member: '👤', student: '🎓', instructor: '🧑‍🏫', teacher: '🧑‍🏫', staff: '👔',
  employee: '👔', child: '👶', kid: '👶', baby: '👶',
  pet: '🐾', dog: '🐕', cat: '🐱', animal: '🐾',
  appointment: '📅', session: '📅', booking: '📅', reservation: '📅', visit: '📅',
  class: '📚', course: '📚', lesson: '📚', workshop: '📚',
  payment: '💳', invoice: '🧾', bill: '🧾', charge: '💰', fee: '💰',
  treatment: '💊', record: '📋', prescription: '💊', medication: '💊',
  workout: '💪', exercise: '💪', plan: '📝', program: '📝',
  job: '🔧', task: '✅', project: '📊', service: '🛠️', order: '📦',
  crew: '👷', team: '👥', group: '👥',
  attendance: '✅', checkin: '✅', schedule: '🗓️',
  note: '📝', comment: '💬', feedback: '💬', review: '⭐',
  product: '📦', item: '📦', inventory: '📦',
  vehicle: '🚗', car: '🚗', room: '🏠', property: '🏠', location: '📍',
};

export function inferIcon(entityName: string): string {
  const lower = entityName.toLowerCase();
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return '📄';
}

// ── Field finders ──

/** Dates that represent metadata (birth, founding) rather than schedulable events. */
export const METADATA_DATE_PATTERNS = /birth|dob|founded|established|joined|registered|hired|anniversary/i;

export function findPrimaryTextField(entity: Entity | undefined): string {
  if (!entity) return 'name';
  const systemFields = new Set(['id', 'created_at', 'updated_at', 'archived']);
  const isUsable = (f: Field) => !systemFields.has(f.name) && !f.name.endsWith('_id');
  if (entity.fields.some(f => f.name === 'name')) return 'name';
  const searchable = entity.fields.find(f => f.searchable && f.type === 'text' && isUsable(f));
  if (searchable) return searchable.name;
  const textField = entity.fields.find(f => f.type === 'text' && isUsable(f));
  if (textField) return textField.name;
  const firstField = entity.fields.find(isUsable);
  if (firstField) return firstField.name;
  const fallback = entity.fields.find(f => !systemFields.has(f.name));
  return fallback?.name || 'name';
}

const SUBTITLE_PREFERRED = ['description', 'reason', 'notes', 'note', 'topic', 'activity', 'service', 'title', 'summary'];
const CATEGORY_CHOICE_NAMES = /^(type|package|plan|category|kind|level|tier|grade|stage|phase|class|format|variant|option)$/i;
const STATUS_CHOICE_NAMES = /^(status|state)$/i;

/** A choice field that describes a category (Type=Monthly, Package=Premium) rather than a lifecycle state (Status=Scheduled). */
export function isCategoryChoice(fieldName: string): boolean {
  return CATEGORY_CHOICE_NAMES.test(fieldName);
}

/** A choice field whose values are lifecycle states (Status=Scheduled/Active/Completed). */
export function isStatusChoice(fieldName: string): boolean {
  return STATUS_CHOICE_NAMES.test(fieldName);
}

/**
 * Find the best subtitle field on an entity, excluding the title field.
 * Ranking: descriptive text (description/notes/reason) → other text/note →
 * category-like choice (type/package/plan) → any other choice → status-like
 * choice (last resort) → null.
 */
export function findSubtitleField(entity: Entity | undefined, excludeField: string): string | null {
  if (!entity) return null;
  const systemFields = new Set(['id', 'created_at', 'updated_at', 'archived']);
  const isUsable = (f: Field) =>
    !systemFields.has(f.name) && f.name !== excludeField && !f.name.endsWith('_id');

  for (const pref of SUBTITLE_PREFERRED) {
    const field = entity.fields.find(f => f.name.toLowerCase() === pref && isUsable(f));
    if (field) return field.name;
  }
  const textField = entity.fields.find(f => (f.type === 'text' || f.type === 'note') && isUsable(f));
  if (textField) return textField.name;
  const categoryChoice = entity.fields.find(f => f.type === 'choice' && isUsable(f) && isCategoryChoice(f.name));
  if (categoryChoice) return categoryChoice.name;
  const otherChoice = entity.fields.find(f => f.type === 'choice' && isUsable(f) && !isStatusChoice(f.name));
  if (otherChoice) return otherChoice.name;
  const statusChoice = entity.fields.find(f => f.type === 'choice' && isUsable(f));
  if (statusChoice) return statusChoice.name;
  return null;
}

/**
 * Find the best scheduling date field on an entity.
 * Prefers schedule-like names over metadata (date_of_birth, founded_on).
 * Returns null if all date fields are metadata.
 */
export function findScheduleDateField(entity: Entity | undefined): Field | null {
  if (!entity) return null;
  const dateFields = entity.fields.filter(f => f.type === 'datetime' || f.type === 'date');
  if (dateFields.length === 0) return null;
  const scheduleDates = dateFields.filter(f => !METADATA_DATE_PATTERNS.test(f.name));
  if (scheduleDates.length > 0) return scheduleDates[0];
  return null;
}

/**
 * Validate a template string against an entity's fields.
 * Replaces invalid-only-placeholder templates with `{primary_text_field}`.
 */
export function validateTemplate(template: string, entity: Entity | undefined): string {
  if (!entity || !template) return template;
  const fieldNames = new Set(entity.fields.map(f => f.name));
  const specialTokens = new Set(['time_of_day', 'time']);

  if (template.match(/\{[a-zA-Z_]+\.[a-zA-Z_]+\}/)) return template;

  const placeholders = Array.from(template.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g));
  const hasInvalid = placeholders.some(m => !fieldNames.has(m[1]) && !specialTokens.has(m[1]));
  const allFK = placeholders.length > 0 && placeholders
    .filter(m => !specialTokens.has(m[1]))
    .every(m => m[1].endsWith('_id'));

  if (hasInvalid || allFK) {
    const primary = findPrimaryTextField(entity);
    console.log(`[normalizeSpec] Template '${template}' has ${hasInvalid ? 'invalid' : 'FK-only'} refs for '${entity.name}', using '{${primary}}'`);
    return `{${primary}}`;
  }
  return template;
}
