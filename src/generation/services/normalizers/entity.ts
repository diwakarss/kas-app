/**
 * Entity / field / relationship normalization + role-aware status taxonomy.
 *
 * Fills in defaults on shapes coming out of the LLM, then (after role
 * classification) injects or repairs status fields so payment/account/
 * document entities get domain-appropriate choices.
 */

import type { Entity, Field, Relationship } from '../../../core/types/spec';
import { humanize, smartPlural, inferIcon } from './shared';
import { classifyEntityRole, isPersonLikeEntity, type EntityRole } from './roles';

/** Fields that are text-searchable by default. */
const SEARCHABLE_TYPES = new Set(['text', 'email', 'phone']);

/** Default options for common choice field names. */
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

export function normalizeField(field: Partial<Field>): Field {
  const name = field.name || 'unnamed_field';
  const type = field.type || 'text';
  const isFK = name.endsWith('_id');

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

export function normalizeRelationship(rel: Partial<Relationship>, entityName: string, index: number): Relationship {
  const target = rel.target || `Unknown_${index}`;
  return {
    target,
    type: rel.type || 'belongs_to',
    foreign_key: rel.foreign_key || `${target.toLowerCase()}_id`,
    display_in_story: rel.display_in_story ?? true,
  } as Relationship;
}

export function normalizeEntity(entity: Partial<Entity>): Entity {
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

// ── Role-aware status taxonomy ──

/**
 * Status taxonomies per entity role. null means "don't auto-inject"
 * (person/container/record — no workflow state to track).
 */
const STATUS_TAXONOMY_BY_ROLE: Record<EntityRole, { options: string[]; default: string } | null> = {
  activity: { options: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled' },
  document: { options: ['Draft', 'In Review', 'Active', 'Closed'], default: 'Draft' },
  payment: { options: ['Pending', 'Paid', 'Partial', 'Overdue', 'Refunded'], default: 'Pending' },
  account: { options: ['Active', 'Low Balance', 'Depleted', 'Closed'], default: 'Active' },
  person: null,
  container: null,
  record: null,
};

/** Options are "generic activity status" when they look like the default Scheduled-style set. */
function isGenericActivityStatus(options: string[] | undefined): boolean {
  if (!options || options.length === 0) return false;
  const lower = new Set(options.map(o => o.toLowerCase()));
  const hasCancelled = lower.has('cancelled');
  const hasCompleted = lower.has('completed');
  const hasInProgress = lower.has('in progress') || lower.has('in-progress');
  const startsWithActivity = lower.has('scheduled') || lower.has('pending');
  return startsWithActivity && hasInProgress && hasCompleted && hasCancelled;
}

/**
 * Inject or repair the status field so payment/account/document entities get
 * a domain-appropriate taxonomy. If the LLM supplied non-generic custom
 * options, respect them — they're presumably vertical-specific.
 */
export function normalizeStatusForRole(entity: Entity): void {
  const role = classifyEntityRole(entity);
  const taxonomy = STATUS_TAXONOMY_BY_ROLE[role];
  if (!taxonomy) return;

  if (role === 'activity') {
    const hasBelongsTo = entity.relationships.some(r => r.type === 'belongs_to');
    const hasChoiceField = entity.fields.some(f => f.type === 'choice');
    if (hasBelongsTo && !hasChoiceField && !isPersonLikeEntity(entity)) {
      entity.fields.push(normalizeField({
        name: 'status',
        type: 'choice',
        required: false,
        options: taxonomy.options,
        default_value: taxonomy.default,
      }));
      console.log(`[normalizeSpec] Injected status field on activity entity '${entity.name}'`);
    }
    return;
  }

  const existingStatus = entity.fields.find(f => f.name === 'status');
  if (!existingStatus) {
    entity.fields.push(normalizeField({
      name: 'status',
      type: 'choice',
      required: false,
      options: taxonomy.options,
      default_value: taxonomy.default,
    }));
    console.log(`[normalizeSpec] Injected ${role} status field on '${entity.name}': ${taxonomy.options.join('/')}`);
    return;
  }
  if (existingStatus.type === 'choice' && isGenericActivityStatus(existingStatus.options)) {
    console.log(`[normalizeSpec] Replaced generic status on ${role} entity '${entity.name}': ${(existingStatus.options || []).join('/')} → ${taxonomy.options.join('/')}`);
    existingStatus.options = taxonomy.options;
    if (existingStatus.default_value === 'Scheduled' || existingStatus.default_value === 'Pending') {
      existingStatus.default_value = taxonomy.default;
    }
  }
}
