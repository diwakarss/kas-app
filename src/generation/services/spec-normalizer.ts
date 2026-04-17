/**
 * Spec Normalizer
 *
 * Fills in default values for missing optional fields in LLM-generated specs.
 * This ensures specs are complete even when the LLM doesn't include all fields.
 */

import type { KASAppSpec, Entity, Field, Relationship } from '../../core/types/spec';

// ── Humanization helpers ──

/** Convert snake_case or CamelCase to Title Case: "session_date" → "Session Date", "RepairOrder" → "Repair Order" */
function humanize(name: string): string {
  return name
    .replace(/_id$/, '')
    // Split CamelCase: "RepairOrder" → "Repair Order"
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

function smartPlural(name: string): string {
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

function inferIcon(entityName: string): string {
  const lower = entityName.toLowerCase();
  // Direct match
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  // Partial match (e.g., "PersonalTrainingSession" contains "session")
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return '📄';
}

/** Person-like entity names — entities that represent people, pets, or subjects */
const PERSON_LIKE_NAMES = new Set([
  'client', 'customer', 'patient', 'member', 'student', 'child', 'kid',
  'pet', 'dog', 'cat', 'animal', 'owner', 'parent', 'employee', 'staff',
  'instructor', 'teacher', 'trainer', 'therapist', 'doctor',
]);

/** Container entity names — records that represent groupings/accounts rather than daily activity */
const CONTAINER_NAMES = new Set([
  'couple', 'family', 'household', 'account', 'company', 'organization',
  'team', 'group', 'profile', 'case', 'project',
]);

/** Check if an entity represents a person/subject (by name or structure) */
function isPersonLikeEntity(entity: Entity): boolean {
  if (PERSON_LIKE_NAMES.has(entity.name.toLowerCase())) return true;
  const fieldNames = new Set(entity.fields.map(f => f.name.toLowerCase()));
  return fieldNames.has('name') && (fieldNames.has('email') || fieldNames.has('phone'));
}

/**
 * Container anchors (Couple, Family, Company, …) have one or two far-future
 * dates (wedding_date, founded_on) that happen to satisfy the scheduling
 * heuristic but don't generate day-to-day activity. Swap them to a child
 * activity entity so the home screen renders something useful.
 */
function isContainerEntity(entity: Entity): boolean {
  return CONTAINER_NAMES.has(entity.name.toLowerCase());
}

/**
 * Entity role — used by downstream inference (status taxonomy, money close-loop,
 * rollups) to know how an entity fits the business workflow. Pure classification,
 * does not mutate the entity.
 *
 *  - person:   the business's customers/subjects (Client, Patient, Student, …)
 *  - container: groupings (Couple, Family, Company) — see isContainerEntity
 *  - activity: the day-to-day unit of work (Fitting, Showing, Appointment, Tour, Event)
 *  - document: long-lived records tied to a parent (Matter, Order, Contract, Prescription)
 *  - payment:  money-in events (Payment, Invoice, Receipt, Bill, Charge)
 *  - account:  financial aggregations (RetainerAccount, Ledger, Balance, Wallet)
 *  - record:   fallback for anything else (Note, Attachment, Tag, …)
 */
export type EntityRole = 'person' | 'container' | 'activity' | 'document' | 'payment' | 'account' | 'record';

const PAYMENT_NAMES = new Set([
  'payment', 'invoice', 'receipt', 'bill', 'charge', 'transaction', 'refund',
]);

const ACCOUNT_NAMES = new Set([
  'account', 'retaineraccount', 'ledger', 'balance', 'wallet', 'budget',
]);

const DOCUMENT_NAMES = new Set([
  'matter', 'order', 'contract', 'agreement', 'document', 'prescription',
  'policy', 'claim', 'ticket', 'request', 'quote', 'estimate', 'proposal',
]);

const ACTIVITY_DATE_FIELDS = new Set([
  'scheduled_at', 'scheduled_for', 'date', 'start_time', 'appointment_at',
  'visit_at', 'session_at', 'tour_date',
]);

function hasActivityDateField(entity: Entity): boolean {
  for (const f of entity.fields) {
    if (ACTIVITY_DATE_FIELDS.has(f.name.toLowerCase())) return true;
    if ((f.type === 'date' || f.type === 'datetime' || f.type === 'time') &&
        !METADATA_DATE_PATTERNS.test(f.name)) {
      return true;
    }
  }
  return false;
}

function hasMoneyFields(entity: Entity): boolean {
  const fieldNames = new Set(entity.fields.map(f => f.name.toLowerCase()));
  return fieldNames.has('amount') || fieldNames.has('amount_paid') ||
         fieldNames.has('paid_amount') || fieldNames.has('total');
}

/** Classify an entity by role. Pure function — no mutation. */
export function classifyEntityRole(entity: Entity): EntityRole {
  const lower = entity.name.toLowerCase();
  if (PAYMENT_NAMES.has(lower)) return 'payment';
  if (ACCOUNT_NAMES.has(lower)) return 'account';
  if (DOCUMENT_NAMES.has(lower)) return 'document';
  if (isPersonLikeEntity(entity)) return 'person';
  if (isContainerEntity(entity)) return 'container';
  // Structural fallback: money fields → payment; schedulable → activity
  if (hasMoneyFields(entity) && entity.fields.some(f => f.type === 'currency')) {
    return 'payment';
  }
  if (hasActivityDateField(entity)) return 'activity';
  return 'record';
}

/** Auto-detect searchable fields: text, email, phone on non-FK fields */
const SEARCHABLE_TYPES = new Set(['text', 'email', 'phone']);

/** Default options for common choice field names */
const DEFAULT_CHOICE_OPTIONS: Record<string, string[]> = {
  status: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
  level: ['Beginner', 'Intermediate', 'Advanced'],
  priority: ['Low', 'Medium', 'High', 'Urgent'],
  type: ['Standard', 'Premium', 'Custom'],
  payment_method: ['Cash', 'Credit Card', 'Debit Card', 'Online Transfer'],
  method: ['Cash', 'Credit Card', 'Debit Card', 'Online Transfer'],
  size: ['Small', 'Medium', 'Large'],
  gender: ['Male', 'Female', 'Other'],
  rating: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
  frequency: ['Daily', 'Weekly', 'Monthly', 'Yearly'],
  day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/**
 * Normalize a field by adding default values for missing properties.
 */
function normalizeField(field: Partial<Field>): Field {
  const name = field.name || 'unnamed_field';
  const type = field.type || 'text';
  const isFK = name.endsWith('_id');

  // Infer options for choice fields that don't have them
  let options = field.options;
  if (type === 'choice' && (!options || options.length === 0)) {
    options = DEFAULT_CHOICE_OPTIONS[name.toLowerCase()];
  }

  return {
    name,
    display_name: field.display_name && field.display_name !== field.name
      ? field.display_name
      : humanize(name),
    type,
    required: field.required ?? false,
    searchable: field.searchable || (!isFK && SEARCHABLE_TYPES.has(type)),
    options,
    default_value: field.default_value,
  } as Field;
}

/**
 * Normalize a relationship by adding default values for missing properties.
 */
function normalizeRelationship(rel: Partial<Relationship>, entityName: string, index: number): Relationship {
  // If target is missing, use a placeholder
  const target = rel.target || `Unknown_${index}`;

  return {
    target,
    type: rel.type || 'belongs_to',
    foreign_key: rel.foreign_key || `${target.toLowerCase()}_id`,
    display_in_story: rel.display_in_story ?? true,
  } as Relationship;
}

/**
 * Normalize an entity by adding default values for missing properties.
 */
function normalizeEntity(entity: Partial<Entity>): Entity {
  const name = entity.name || 'UnnamedEntity';
  const displayName = entity.display_name || humanize(name);
  const icon = (entity.icon && entity.icon !== '📄') ? entity.icon : inferIcon(name);

  return {
    name,
    display_name: displayName,
    display_name_plural: entity.display_name_plural && entity.display_name_plural !== `${displayName}s`
      ? entity.display_name_plural
      : smartPlural(displayName),
    icon,
    fields: (entity.fields || []).map(normalizeField),
    relationships: (entity.relationships || []).map((rel, i) => normalizeRelationship(rel, name, i)),
  } as Entity;
}

/**
 * Normalize computed fields section.
 */
function normalizeComputedFields(
  computedFields: Record<string, any[]> | undefined
): Record<string, any[]> {
  if (!computedFields) return {};

  const normalized: Record<string, any[]> = {};

  for (const [entityName, fields] of Object.entries(computedFields)) {
    normalized[entityName] = (fields || []).map(field => ({
      name: field.name || 'unnamed_computed',
      display_name: field.display_name || field.name || 'Unnamed',
      type: field.type || 'count',
      source_entity: field.source_entity,
      relationship: field.relationship,
      source_field: field.source_field,
      formula: field.formula,
    }));
  }

  return normalized;
}

/**
 * Normalize anchor section.
 */
function findPrimaryTextField(entity: Entity | undefined): string {
  if (!entity) return 'name';
  const systemFields = new Set(['id', 'created_at', 'updated_at', 'archived']);
  const isUsable = (f: Field) => !systemFields.has(f.name) && !f.name.endsWith('_id');
  // Prefer a field literally named "name"
  if (entity.fields.some(f => f.name === 'name')) return 'name';
  // Then first searchable text field
  const searchable = entity.fields.find(f => f.searchable && f.type === 'text' && isUsable(f));
  if (searchable) return searchable.name;
  // Then first text field (never FK)
  const textField = entity.fields.find(f => f.type === 'text' && isUsable(f));
  if (textField) return textField.name;
  // Then first non-system, non-FK field
  const firstField = entity.fields.find(isUsable);
  if (firstField) return firstField.name;
  // Last resort: any non-system field (may be an FK; caller should fall through
  // to cross-entity title resolution when this returns an _id)
  const fallback = entity.fields.find(f => !systemFields.has(f.name));
  return fallback?.name || 'name';
}

/**
 * Find the best subtitle field on an entity, excluding the title field.
 * Prefers descriptive text (description/notes/reason) → other text → choice status → last resort date.
 */
const SUBTITLE_PREFERRED = ['description', 'reason', 'notes', 'note', 'topic', 'activity', 'service', 'title', 'summary'];

function findSubtitleField(entity: Entity | undefined, excludeField: string): string | null {
  if (!entity) return null;
  const systemFields = new Set(['id', 'created_at', 'updated_at', 'archived']);
  const isUsable = (f: Field) =>
    !systemFields.has(f.name) && f.name !== excludeField && !f.name.endsWith('_id');

  // 1. Preferred descriptive fields (description, reason, notes, etc.)
  for (const pref of SUBTITLE_PREFERRED) {
    const field = entity.fields.find(f => f.name.toLowerCase() === pref && isUsable(f));
    if (field) return field.name;
  }
  // 2. Any non-primary, non-FK text field
  const textField = entity.fields.find(f => f.type === 'text' && isUsable(f));
  if (textField) return textField.name;
  // 3. Choice/status field
  const choiceField = entity.fields.find(f => f.type === 'choice' && isUsable(f));
  if (choiceField) return choiceField.name;
  // 4. Don't fall back to raw date — let the subtitle stay empty
  return null;
}

/**
 * Validate a template string against an entity's fields.
 * If any placeholder references a field that doesn't exist, replace with the primary text field.
 */
function validateTemplate(template: string, entity: Entity | undefined): string {
  if (!entity || !template) return template;
  const fieldNames = new Set(entity.fields.map(f => f.name));
  const specialTokens = new Set(['time_of_day', 'time']);

  // Allow templates with dot-notation (cross-entity refs) to pass through
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

/**
 * Find the best scheduling date field on an entity.
 * Prefers schedule-like names (date, appointment_date, session_date, start_date)
 * over metadata-like names (date_of_birth, birth_date, created_at, dob).
 * Returns null if no scheduling date field exists.
 */
const METADATA_DATE_PATTERNS = /birth|dob|founded|established|joined|registered|hired|anniversary/i;

function findScheduleDateField(entity: Entity | undefined): Field | null {
  if (!entity) return null;
  const dateFields = entity.fields.filter(f => f.type === 'datetime' || f.type === 'date');
  if (dateFields.length === 0) return null;
  // Filter out metadata dates
  const scheduleDates = dateFields.filter(f => !METADATA_DATE_PATTERNS.test(f.name));
  if (scheduleDates.length > 0) return scheduleDates[0];
  // All dates are metadata — return null so anchor falls back to active_list
  return null;
}

function normalizeAnchor(anchor: Partial<KASAppSpec['anchor']> | undefined, entities: Entity[]): KASAppSpec['anchor'] {
  const defaultEntity = entities[0]?.name || 'Item';
  let anchorEntityName = anchor?.entity || defaultEntity;
  let anchorEntity = entities.find(e => e.name === anchorEntityName) || entities[0];
  let anchorType = anchor?.type || 'day_schedule';
  let anchorSwapped = false;

  // Auto-swap: if the anchor entity lacks a schedule date field but the app is
  // set up as a day_schedule, find an activity entity (belongs_to + datetime)
  // and use that instead. Covers person-like anchors (e.g. Couple, Client) AND
  // transactional anchors that just don't have a date on them (e.g. Order in
  // the tailor spec).
  const needsScheduleSwap =
    anchorEntity &&
    anchorType === 'day_schedule' &&
    !findScheduleDateField(anchorEntity);

  // Container swap: anchor entity is a grouping (Couple, Family, Company) and
  // has a child entity with its own recurring schedule date. Even though the
  // container has a date (wedding_date), the child activity reads better on
  // the home screen.
  const prefersChildActivity =
    !needsScheduleSwap &&
    anchorEntity &&
    anchorType === 'day_schedule' &&
    (isContainerEntity(anchorEntity) || isPersonLikeEntity(anchorEntity));

  const findActivityChild = (parent: Entity) =>
    entities.find(e =>
      e.name !== parent.name &&
      !isPersonLikeEntity(e) &&
      !isContainerEntity(e) &&
      e.relationships.some(r => r.type === 'belongs_to' && r.target === parent.name) &&
      findScheduleDateField(e) !== null
    );

  if (needsScheduleSwap) {
    const activityEntity = entities.find(e =>
      e.name !== anchorEntity!.name &&
      e.relationships.some(r => r.type === 'belongs_to') &&
      findScheduleDateField(e) !== null
    );
    if (activityEntity) {
      console.log(`[normalizeSpec] Anchor swap: '${anchorEntityName}' (no schedule date) → '${activityEntity.name}' (activity with date)`);
      anchorEntityName = activityEntity.name;
      anchorEntity = activityEntity;
      anchorSwapped = true;
    } else {
      // No schedulable child exists → downgrade to active_list so the runtime
      // stops rendering a day-schedule view with a blank time column.
      console.log(`[normalizeSpec] Anchor type downgrade: '${anchorEntityName}' has no date and no schedulable child → anchor.type = 'active_list'`);
      anchorType = 'active_list';
    }
  } else if (prefersChildActivity) {
    const activityEntity = findActivityChild(anchorEntity!);
    if (activityEntity) {
      console.log(`[normalizeSpec] Container anchor swap: '${anchorEntityName}' (container/person-like) → '${activityEntity.name}' (recurring activity)`);
      anchorEntityName = activityEntity.name;
      anchorEntity = activityEntity;
      anchorSwapped = true;
    }
  }

  const primaryField = findPrimaryTextField(anchorEntity);
  const dateTimeField = findScheduleDateField(anchorEntity);

  // Smart default title: if primary field is a date and entity has belongs_to, use related entity name
  let defaultTitle = `{${primaryField}}`;
  let defaultSubtitle = '';
  if (anchorEntity) {
    const primaryFieldDef = anchorEntity.fields.find(f => f.name === primaryField);
    const primaryIsDate = primaryFieldDef && (primaryFieldDef.type === 'date' || primaryFieldDef.type === 'datetime');

    if (primaryIsDate) {
      const belongsTo = anchorEntity.relationships.find(r => r.type === 'belongs_to');
      if (belongsTo) {
        const parentEntity = entities.find(e => e.name === belongsTo.target);
        if (parentEntity) {
          const parentPrimary = findPrimaryTextField(parentEntity);
          defaultTitle = `{${belongsTo.target.toLowerCase()}.${parentPrimary}}`;
          // Prefer a text subtitle over the date that's now the title reference
          const subField = findSubtitleField(anchorEntity, primaryField);
          defaultSubtitle = subField ? `{${subField}}` : '';
        }
      }
    }

    // Phase B: if Phase A didn't fire and anchor entity belongs_to a person-like entity, flip title to person name
    if (defaultTitle === `{${primaryField}}`) {
      const belongsToRels = anchorEntity.relationships.filter(r => r.type === 'belongs_to');
      for (const bt of belongsToRels) {
        const parent = entities.find(e => e.name === bt.target);
        if (parent && isPersonLikeEntity(parent)) {
          const parentPrimary = findPrimaryTextField(parent);
          defaultTitle = `{${bt.target.toLowerCase()}.${parentPrimary}}`;
          const subField = findSubtitleField(anchorEntity, primaryField);
          defaultSubtitle = subField ? `{${subField}}` : '';
          console.log(`[normalizeSpec] Anchor title Phase B: using person-like ${bt.target}.${parentPrimary}`);
          break;
        }
      }
    }

    // Phase C: primary field is not a proper text field (it's an FK, choice,
    // date, or number). Fall back to any belongs_to parent's primary text so
    // the card title shows something human. Covers chains like
    // Fitting → Order → Client (tailor spec).
    const primaryIsWeak =
      primaryFieldDef &&
      (primaryField.endsWith('_id') ||
        ['choice', 'number', 'currency', 'date', 'datetime', 'time'].includes(primaryFieldDef.type));
    if (defaultTitle === `{${primaryField}}` && primaryIsWeak) {
      const belongsToRels = anchorEntity.relationships.filter(r => r.type === 'belongs_to');
      for (const bt of belongsToRels) {
        const parent = entities.find(e => e.name === bt.target);
        if (!parent) continue;
        const parentPrimary = findPrimaryTextField(parent);
        const parentPrimaryDef = parent.fields.find(f => f.name === parentPrimary);
        if (!parentPrimaryDef || parentPrimary.endsWith('_id')) continue;
        defaultTitle = `{${bt.target.toLowerCase()}.${parentPrimary}}`;
        const subField = findSubtitleField(anchorEntity, primaryField);
        defaultSubtitle = subField ? `{${subField}}` : '';
        console.log(`[normalizeSpec] Anchor title Phase C: weak primary '${primaryField}' → parent ${bt.target}.${parentPrimary}`);
        break;
      }
    }

    // Default subtitle when title uses entity's own primary text field
    if (!defaultSubtitle && defaultTitle === `{${primaryField}}`) {
      const subField = findSubtitleField(anchorEntity, primaryField);
      if (subField) defaultSubtitle = `{${subField}}`;
    }
  }

  // Enrichment: anchor entity plural noun for stats labels
  // Applies whether business_type is in the library or 'custom' — the LLM
  // routinely ships generic "Today" / "This Week" labels; surfacing the
  // entity noun makes the home screen feel like the user's actual business.
  const anchorPlural = anchorEntity?.display_name_plural || anchorEntity?.display_name || 'Items';

  // If we swapped the anchor entity, the LLM's original card_display templates
  // were written for a different entity. Ignore them and recompute from
  // defaults based on the new anchor entity.
  const rawTitle = !anchorSwapped && anchor?.card_display?.title
    ? anchor.card_display.title
    : defaultTitle;
  const validatedTitle = validateTemplate(rawTitle, anchorEntity);
  const rawSubtitle = !anchorSwapped && anchor?.card_display?.subtitle
    ? anchor.card_display.subtitle
    : defaultSubtitle;
  let validatedSubtitle = validateTemplate(rawSubtitle, anchorEntity);

  const finalTimeField = (!anchorSwapped && anchor?.card_display?.time_field) || dateTimeField?.name || null;

  // Fix: subtitle and time_field pointing at the same field leaves the subtitle
  // rendering a duplicate of the time column. Swap to a descriptive text field.
  if (finalTimeField && validatedSubtitle === `{${finalTimeField}}`) {
    const alt = findSubtitleField(anchorEntity, finalTimeField);
    if (alt) {
      console.log(`[normalizeSpec] Anchor subtitle collided with time_field '${finalTimeField}' → swapped to '{${alt}}'`);
      validatedSubtitle = `{${alt}}`;
    } else {
      console.log(`[normalizeSpec] Anchor subtitle collided with time_field '${finalTimeField}' and no descriptive field found → cleared subtitle`);
      validatedSubtitle = '';
    }
  }

  // Greeting: ensure business_name is present. The LLM frequently omits it,
  // which leaves the home screen greeting feeling anonymous.
  let greetingTemplate = anchor?.greeting_template || 'Good {time_of_day}, {business_name}';
  if (!greetingTemplate.includes('{business_name}')) {
    greetingTemplate = `${greetingTemplate.replace(/[.!\s]+$/, '')}, {business_name}`;
    console.log(`[normalizeSpec] Greeting template missing {business_name} → appended`);
  }

  // Stats: upgrade generic "Today"/"This Week" labels to entity-aware ones so
  // the anchor reads "Matters Today / This Week" instead of bare counts.
  const rawStats = anchor?.summary?.stats;
  const isDefaultStats =
    !rawStats ||
    rawStats.length === 0 ||
    (rawStats.length <= 2 &&
      rawStats.every(s =>
        /^(today|this week|week|today's?)$/i.test((s as any).label || '')
      ));

  let enrichedStats = rawStats as Array<{ label: string; query: string }> | undefined;
  if (isDefaultStats) {
    enrichedStats = [
      { label: `${anchorPlural} Today`, query: 'today_count' },
      { label: 'This Week', query: 'week_count' },
    ];
    // Add a third "Active" stat when there is a status-like field to filter on
    const hasStatusField = anchorEntity?.fields.some(
      f => f.type === 'choice' && /status|state/i.test(f.name)
    );
    if (hasStatusField) {
      enrichedStats.push({ label: `Active ${anchorPlural}`, query: 'active_count' });
    }
    console.log(`[normalizeSpec] Stats enriched with entity noun '${anchorPlural}'`);
  }

  return {
    entity: anchorEntityName,
    type: anchorType,
    greeting_template: greetingTemplate,
    date_label: anchor?.date_label || 'today',
    card_display: {
      ...anchor?.card_display,
      title: validatedTitle,
      subtitle: validatedSubtitle,
      time_field: finalTimeField,
      actions: anchor?.card_display?.actions || ['edit', 'delete'],
    },
    empty_state: {
      message: anchor?.empty_state?.message || `No ${anchorPlural.toLowerCase()} today`,
      action: anchor?.empty_state?.action || `Add ${anchorEntity?.display_name?.toLowerCase() || 'an item'}`,
      fallback_view: anchor?.empty_state?.fallback_view || 'calendar',
      ...anchor?.empty_state,
    },
    summary: {
      ...anchor?.summary,
      stats: enrichedStats as any,
    },
  } as KASAppSpec['anchor'];
}

/**
 * Infer story_events for entities that are belongs_to targets.
 * If entity X has children pointing at it, story_events[X] should list those children.
 */
function inferStoryEvents(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };

  // Find which entities are targets of belongs_to relationships
  for (const entity of entities) {
    for (const rel of entity.relationships) {
      if (rel.type === 'belongs_to' && !result[rel.target]) {
        const childEntity = entity;
        const parentEntity = entities.find(e => e.name === rel.target);
        if (!parentEntity) continue;

        const dateField = childEntity.fields.find(f =>
          f.type === 'datetime' || f.type === 'date'
        );

        const childPrimary = findPrimaryTextField(childEntity);
        const parentPrimary = findPrimaryTextField(parentEntity);
        const childPrimaryDef = childEntity.fields.find(f => f.name === childPrimary);
        const needsPrefix = childPrimaryDef && ['date', 'datetime', 'number', 'currency'].includes(childPrimaryDef.type);
        const displayTemplate = needsPrefix ? `${childEntity.display_name}: {${childPrimary}}` : `{${childPrimary}}`;
        console.log(`[normalizeSpec] Inferred story_events for '${rel.target}' from '${childEntity.name}'`);
        result[rel.target] = {
          events: [{
            source: childEntity.name,
            relationship: rel.foreign_key,
            type: childEntity.name.toLowerCase(),
            display: displayTemplate,
            icon_color: 'stream',
          }],
          stats_card: [{ label: `{${parentPrimary}}` }],
          origin: 'Created on {created_at}',
          context: parentEntity.display_name,
          ...(dateField ? {
            coming_up: {
              source: childEntity.name,
              relationship: rel.foreign_key,
              display: `{${childPrimary}}`,
              sort: 'asc',
            },
          } : {}),
        };
      }
    }
  }

  return result;
}

/**
 * Ensure every non-system entity has a story_events entry so the Story screen
 * has something to render. Leaf entities (Invoice, Payment, Fitting) that are
 * not belongs_to targets still deserve a minimal block with their own primary
 * field as the stats_card label and a sensible origin line.
 */
function ensureStoryEventsForAllEntities(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };
  for (const entity of entities) {
    if (result[entity.name]) continue;
    const primary = findPrimaryTextField(entity);
    const primaryDef = entity.fields.find(f => f.name === primary);
    const needsPrefix =
      primaryDef &&
      (primary.endsWith('_id') ||
        ['date', 'datetime', 'number', 'currency'].includes(primaryDef.type));
    const statsLabel = needsPrefix
      ? `${entity.display_name}: {${primary}}`
      : `{${primary}}`;
    console.log(`[normalizeSpec] Minimal story_events for leaf entity '${entity.name}'`);
    result[entity.name] = {
      events: [],
      stats_card: [{ label: statsLabel }],
      origin: 'Created on {created_at}',
      context: entity.display_name,
    };
  }
  return result;
}

/**
 * Infer add_flows for entities that don't have them.
 * Creates a step-per-field flow for each entity.
 */
/** Generate a human-friendly prompt for an add flow step */
function humanizePrompt(fieldName: string, entity: Entity | undefined): string {
  // FK fields → "Select {parent entity}"
  if (fieldName.endsWith('_id') && entity) {
    const rel = entity.relationships.find(r => r.foreign_key === fieldName);
    if (rel) return `Select ${humanize(rel.target).toLowerCase()}`;
    return `Select ${humanize(fieldName)}`;
  }
  const label = humanize(fieldName).toLowerCase();
  return `Enter ${label}`;
}

/**
 * When a step's field is an `_id` FK with a matching belongs_to relationship,
 * build the step-level picker props. Returns {} for non-FK fields.
 */
function buildEntityPickerProps(
  fieldName: string,
  entity: Entity
): { field_type?: 'entity_picker'; entity_target?: string } {
  if (!fieldName.endsWith('_id')) return {};
  const rel = entity.relationships.find(
    r => r.type === 'belongs_to' && r.foreign_key === fieldName
  );
  if (!rel) return {};
  return { field_type: 'entity_picker', entity_target: rel.target };
}

/**
 * Backfill field_type: 'entity_picker' onto LLM-emitted steps that reference
 * an `_id` FK. Idempotent — skips steps that already have field_type set.
 */
function markEntityPickerSteps(flow: any, entity: Entity): void {
  if (!flow || !Array.isArray(flow.steps)) return;
  for (const step of flow.steps) {
    if (step.field_type || !step.field) continue;
    const props = buildEntityPickerProps(step.field, entity);
    if (props.field_type) {
      step.field_type = props.field_type;
      step.entity_target = props.entity_target;
    }
  }
}

/**
 * Prepend picker steps for belongs_to FKs that aren't already a step in the
 * flow. Without this, child entities have no way to set their FK and records
 * land orphaned. Drill-down creation still works because preFill is applied
 * before the step loop renders — the hook hides pre-filled steps at render
 * time (see useAddFlow).
 */
function injectMissingFKSteps(flow: any, entity: Entity): void {
  if (!flow || !Array.isArray(flow.steps)) return;
  const existingFields = new Set(flow.steps.map((s: any) => s.field));
  const missingFKSteps: any[] = [];
  for (const rel of entity.relationships) {
    if (rel.type !== 'belongs_to') continue;
    if (existingFields.has(rel.foreign_key)) continue;
    missingFKSteps.push({
      field: rel.foreign_key,
      prompt: `Select ${rel.target}`,
      required: true,
      field_type: 'entity_picker',
      entity_target: rel.target,
    });
  }
  if (missingFKSteps.length > 0) {
    flow.steps = [...missingFKSteps, ...flow.steps];
    console.log(
      `[normalizeSpec] Injected ${missingFKSteps.length} FK picker step(s) into '${entity.name}' add_flow`
    );
  }
}

function inferAddFlows(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };

  for (const entity of entities) {
    if (result[entity.name]) {
      // Existing flow — backfill entity_picker on _id steps the LLM already emitted
      markEntityPickerSteps(result[entity.name], entity);
      continue;
    }

    // Skip system fields
    const userFields = entity.fields.filter(f =>
      !['id', 'created_at', 'updated_at', 'archived'].includes(f.name)
    );
    if (userFields.length === 0) continue;

    console.log(`[normalizeSpec] Inferred add_flow for '${entity.name}'`);
    result[entity.name] = {
      steps: userFields.map(f => ({
        field: f.name,
        prompt: humanizePrompt(f.name, entity),
        required: f.required ?? false,
        ...(f.type === 'number' || f.type === 'currency' ? { keyboard: 'numeric' } : {}),
        ...(f.type === 'phone' ? { keyboard: 'phone-pad' } : {}),
        ...(f.type === 'email' ? { keyboard: 'email-address' } : {}),
        ...(buildEntityPickerProps(f.name, entity)),
      })),
    };
  }

  // Infer after_add flows: after adding a parent entity, suggest adding a child
  for (const entity of entities) {
    const flow = result[entity.name];
    if (!flow || flow.after_add) continue;
    // Find a child entity that belongs_to this entity
    const childEntity = entities.find(child =>
      child.name !== entity.name &&
      child.relationships.some(r => r.type === 'belongs_to' && r.target === entity.name)
    );
    if (childEntity) {
      const childRel = childEntity.relationships.find(r => r.type === 'belongs_to' && r.target === entity.name);
      if (childRel) {
        flow.after_add = {
          action: 'suggest',
          target: childEntity.name,
          text: `Add ${childEntity.display_name}`,
          pre_fill: { [childRel.foreign_key]: '{id}' },
        };
      }
    }
  }

  // Inject missing FK picker steps so standalone creation works. Drill-down
  // creation still works because useAddFlow hides steps pre-filled by the parent.
  for (const entity of entities) {
    const flow = result[entity.name];
    if (!flow) continue;
    injectMissingFKSteps(flow, entity);
  }

  return result;
}

/**
 * Infer default chat_commands from entities when the spec ships without any.
 * Emits an "add {entity}" command for every user-facing entity and a
 * "show {entity plural} today" command for entities that have a schedule date.
 */
function inferChatCommands(
  existing: any[],
  entities: Entity[]
): any[] {
  if (existing && existing.length > 0) return existing;

  const commands: any[] = [];
  for (const entity of entities) {
    const displayLower = entity.display_name.toLowerCase();
    const pluralLower = entity.display_name_plural.toLowerCase();
    // add <entity>
    commands.push({
      pattern: `add ${displayLower}`,
      aliases: [`new ${displayLower}`, `create ${displayLower}`],
      action: {
        type: 'addEntity',
        entity: entity.name,
      },
      requires_confirmation: false,
    });
    // show <entity plural> today (only if entity has a schedule date)
    if (findScheduleDateField(entity)) {
      commands.push({
        pattern: `show ${pluralLower} today`,
        aliases: [`${pluralLower} today`, `today's ${pluralLower}`],
        action: {
          type: 'navigate',
          entity: entity.name,
        },
        requires_confirmation: false,
      });
    }
  }

  if (commands.length > 0) {
    console.log(`[normalizeSpec] Inferred ${commands.length} chat_commands from ${entities.length} entities`);
  }

  return commands;
}

/**
 * Fix double-brace templates {{field}} → {field} in any string value recursively.
 */
function fixTemplateSyntax(obj: any): any {
  if (typeof obj === 'string') {
    let s = obj;
    s = s.replace(/\{\{(\w+)\}\}/g, '{$1}');
    s = s.replace(/\{\{[^}]*\}\}/g, '');
    s = s.replace(/\$\{(\w+)\}/g, '{$1}');
    s = s.replace(/\$\{[^}]+\}/g, '');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  if (Array.isArray(obj)) return obj.map(fixTemplateSyntax);
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) result[k] = fixTemplateSyntax(v);
    return result;
  }
  return obj;
}

/**
 * Normalize story_events: fix array format and ensure {events} structure.
 */
function normalizeStoryEventsFormat(
  raw: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const fixed: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      console.log(`[normalizeSpec] Fixed story_events.${key}: array → {events: [...]}`);
      fixed[key] = { events: fixTemplateSyntax(value) };
    } else if (value && typeof value === 'object') {
      fixed[key] = fixTemplateSyntax(value);
      if (!fixed[key].events && !fixed[key].stats_card) {
        fixed[key] = { events: [] };
      }
    }
  }

  // Validate story events: FK must exist on source entity AND point back to the story entity
  for (const [key, config] of Object.entries(fixed)) {
    if (!config?.events) continue;
    config.events = config.events.filter((ev: any) => {
      if (!ev.source || !ev.relationship) return false;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: source '${ev.source}' not found`);
        return false;
      }
      // Check that the FK field exists on the source entity
      const hasFK = srcEntity.fields.some((f: Field) => f.name === ev.relationship);
      if (!hasFK) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' not found on '${ev.source}'`);
        return false;
      }
      // Check that the FK's relationship target matches the story entity
      const rel = srcEntity.relationships.find((r: any) => r.foreign_key === ev.relationship);
      if (rel && rel.target !== key) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' on '${ev.source}' points to '${rel.target}', not '${key}'`);
        return false;
      }
      return true;
    });

    // Validate display templates reference real fields on source entity
    for (const ev of config.events) {
      if (!ev.display || !ev.source) continue;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) continue;
      const srcFields = new Set(srcEntity.fields.map((f: Field) => f.name));
      const hasDotRef = /\{[a-zA-Z_]+\.[a-zA-Z_]+\}/.test(ev.display);
      const simplePlaceholders = Array.from((ev.display as string).matchAll(/\{([a-zA-Z_]\w*)\}/g))
        .filter((m: RegExpMatchArray) => !(ev.display as string).includes(m[1] + '.'));
      const hasInvalid = simplePlaceholders.some((m: RegExpMatchArray) => !srcFields.has(m[1]));
      const allFK = simplePlaceholders.length > 0 && simplePlaceholders.every((m: RegExpMatchArray) => m[1].endsWith('_id'));
      if (hasDotRef || hasInvalid || allFK) {
        const primary = findPrimaryTextField(srcEntity);
        const primaryDef = srcEntity.fields.find((f: Field) => f.name === primary);
        const needsPrefix = primaryDef && ['date', 'datetime', 'number', 'currency'].includes(primaryDef.type);
        const fixedDisplay = needsPrefix ? `${srcEntity.display_name}: {${primary}}` : `{${primary}}`;
        console.log(`[normalizeSpec] Fixed story_events.${key} event display '${ev.display}' → '${fixedDisplay}' for source '${ev.source}'`);
        ev.display = fixedDisplay;
      }
    }

    // Enrich LLM-provided story events with missing stats_card/origin/context
    const targetEntity = entities.find(e => e.name === key);
    if (targetEntity && config.events && !config.stats_card) {
      const primary = findPrimaryTextField(targetEntity);
      config.stats_card = [{ label: `{${primary}}` }];
      config.origin = config.origin || 'Created on {created_at}';
      config.context = config.context || targetEntity.display_name;
      // Add coming_up from first event source that has a date field
      if (!config.coming_up) {
        for (const ev of config.events) {
          const srcEntity = entities.find(e => e.name === ev.source);
          const dateField = srcEntity?.fields.find((f: Field) => f.type === 'datetime' || f.type === 'date');
          if (srcEntity && dateField) {
            config.coming_up = {
              source: srcEntity.name,
              relationship: ev.relationship,
              display: ev.display,
              sort: 'asc',
            };
            break;
          }
        }
      }
    }
  }

  const withChildren = inferStoryEvents(fixed, entities);
  return ensureStoryEventsForAllEntities(withChildren, entities);
}

/**
 * Normalize add_flows: fix array format and ensure {steps} structure.
 */
function normalizeAddFlowsFormat(
  raw: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const fixed: Record<string, any> = {};

  // Handle LLM returning add_flows as an array instead of object
  const entries = Array.isArray(raw)
    ? raw.map((flow: any) => [flow.entity || `flow_${raw.indexOf(flow)}`, flow])
    : Object.entries(raw);

  for (const [key, value] of entries) {
    // Skip numeric keys from LLM returning indexed-object format
    if (/^\d+$/.test(key) && value?.entity) {
      const entityName = value.entity;
      console.log(`[normalizeSpec] Fixed add_flows[${key}] → add_flows.${entityName}`);
      fixed[entityName] = value;
      continue;
    }
    if (Array.isArray(value)) {
      console.log(`[normalizeSpec] Fixed add_flows.${key}: array → {steps: [...]}`);
      fixed[key] = { steps: value };
    } else if (value && typeof value === 'object') {
      fixed[key] = value;
    }
  }

  // Humanize robotic prompts in LLM-provided flows
  for (const [entityName, flow] of Object.entries(fixed)) {
    if (!flow?.steps) continue;
    const entity = entities.find(e => e.name === entityName);
    for (const step of flow.steps) {
      if (!step.prompt || step.prompt.match(/^Enter\s+\w+_/)) {
        step.prompt = humanizePrompt(step.field, entity);
      }
    }
  }

  return inferAddFlows(fixed, entities);
}

/**
 * Normalize a spec by filling in defaults for all missing fields.
 *
 * @param spec - The raw spec from LLM
 * @returns Normalized spec with all required fields populated
 */
export function normalizeSpec(spec: Partial<KASAppSpec>): KASAppSpec {
  // Normalize entities first (needed for other sections)
  const entities = (spec.entities || []).map(normalizeEntity);

  // Get entity names for validation
  const entityNames = new Set(entities.map(e => e.name));

  // Filter relationships to only reference existing entities
  for (const entity of entities) {
    entity.relationships = entity.relationships.filter(rel => {
      if (!entityNames.has(rel.target)) {
        // Try to fuzzy-match the target to an existing entity (case-insensitive)
        const match = entities.find(e =>
          e.name.toLowerCase() === rel.target.toLowerCase() ||
          e.display_name?.toLowerCase() === rel.target.toLowerCase()
        );
        if (match) {
          console.log(`[normalizeSpec] Fixed relationship target '${rel.target}' → '${match.name}' in '${entity.name}'`);
          rel.target = match.name;
          return true;
        }
        console.warn(`[normalizeSpec] Removing invalid relationship in '${entity.name}': target '${rel.target}' not found`);
        return false;
      }
      return true;
    });
  }

  // Infer missing relationships from *_id fields
  for (const entity of entities) {
    const existingTargets = new Set(entity.relationships.map(r => r.target));
    for (const field of entity.fields) {
      if (!field.name.endsWith('_id')) continue;
      const candidateName = field.name.replace(/_id$/, '');
      // Find a matching entity (case-insensitive)
      const target = entities.find(e =>
        e.name.toLowerCase() === candidateName.toLowerCase() ||
        e.name.toLowerCase() === candidateName.replace(/_/g, '').toLowerCase()
      );
      if (target && target.name !== entity.name && !existingTargets.has(target.name)) {
        console.log(`[normalizeSpec] Inferred belongs_to ${entity.name} → ${target.name} from field '${field.name}'`);
        entity.relationships.push({
          target: target.name,
          type: 'belongs_to',
          foreign_key: field.name,
          display_in_story: true,
        } as Relationship);
        existingTargets.add(target.name);
      }
    }
  }

  // Inject status field on activity entities (has validated belongs_to, no choice field)
  for (const entity of entities) {
    const hasBelongsTo = entity.relationships.some(r => r.type === 'belongs_to');
    const hasChoiceField = entity.fields.some(f => f.type === 'choice');
    if (hasBelongsTo && !hasChoiceField && !isPersonLikeEntity(entity)) {
      entity.fields.push(normalizeField({
        name: 'status',
        type: 'choice',
        required: false,
        options: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
        default_value: 'Scheduled',
      }));
      console.log(`[normalizeSpec] Injected status field on activity entity '${entity.name}'`);
    }
  }

  const normalizedAnchor = normalizeAnchor(spec.anchor, entities);

  // Calendar should follow the anchor so both screens render the same list.
  // When the LLM shipped its own calendar block, keep it unless it still points
  // at a different entity than the (possibly swapped) anchor.
  const anchorEntity = entities.find(e => e.name === normalizedAnchor.entity);
  const anchorDateField = anchorEntity ? findScheduleDateField(anchorEntity) : null;
  let calendar = spec.calendar;
  if (!calendar || (anchorEntity && anchorDateField && calendar.entity !== normalizedAnchor.entity)) {
    if (anchorEntity && anchorDateField) {
      if (calendar && calendar.entity !== normalizedAnchor.entity) {
        console.log(`[normalizeSpec] Calendar entity '${calendar.entity}' realigned to anchor '${normalizedAnchor.entity}'`);
      }
      calendar = {
        entity: normalizedAnchor.entity,
        date_field: anchorDateField.name,
        display: `{${findPrimaryTextField(anchorEntity)}}`,
      };
    } else {
      const calEntity = entities.find(e => findScheduleDateField(e) !== null) || entities[0];
      const calDateField = findScheduleDateField(calEntity);
      calendar = {
        entity: calEntity?.name || entities[0]?.name,
        date_field: calDateField?.name || 'date',
        display: `{${findPrimaryTextField(calEntity)}}`,
      };
    }
  }

  return {
    meta: {
      spec_id: spec.meta?.spec_id || crypto.randomUUID?.() || `spec-${Date.now()}`,
      name: spec.meta?.name || 'My App',
      version: spec.meta?.version || 1,
      business_type: spec.meta?.business_type || 'custom',
      created_date: spec.meta?.created_date || new Date().toISOString(),
      base_template: spec.meta?.base_template || 'custom',
      source: spec.meta?.source || 'llm_generated',
      generation_confidence: spec.meta?.generation_confidence ?? 0.8,
      customizations: spec.meta?.customizations || [],
      version_history: spec.meta?.version_history || [{
        version: 1,
        date: new Date().toISOString(),
        source: 'generated',
        changes: 'Initial generation',
      }],
    },
    entities,
    anchor: normalizedAnchor,
    computed_fields: normalizeComputedFields(spec.computed_fields),
    business_rules: spec.business_rules || [],
    story_events: normalizeStoryEventsFormat(spec.story_events || {}, entities),
    add_flows: normalizeAddFlowsFormat(spec.add_flows || {}, entities),
    search: {
      entities: spec.search?.entities || entities.map(e => e.name),
      display: (() => {
        const raw = spec.search?.display || {};
        const display: Record<string, string> = {};
        for (const e of entities) {
          const tmpl = raw[e.name] || `{${findPrimaryTextField(e)}}`;
          display[e.name] = validateTemplate(tmpl, e);
        }
        return display;
      })(),
    },
    calendar,
    chat_commands: inferChatCommands(spec.chat_commands || [], entities),
  } as KASAppSpec;
}

/**
 * Spec Normalizer Service (namespace export)
 */
export const SpecNormalizer = {
  normalize: normalizeSpec,
  normalizeEntity,
  normalizeField,
  normalizeRelationship,
};
