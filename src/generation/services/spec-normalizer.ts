/**
 * Spec Normalizer
 *
 * Fills in default values for missing optional fields in LLM-generated specs.
 * This ensures specs are complete even when the LLM doesn't include all fields.
 */

import type { KASAppSpec, Entity, Field, Relationship } from '../../core/types/spec';

/**
 * Normalize a field by adding default values for missing properties.
 */
function normalizeField(field: Partial<Field>): Field {
  return {
    name: field.name || 'unnamed_field',
    display_name: field.display_name || field.name || 'Unnamed Field',
    type: field.type || 'text',
    required: field.required ?? false,
    searchable: field.searchable ?? false,
    options: field.options,
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

  return {
    name,
    display_name: entity.display_name || name,
    display_name_plural: entity.display_name_plural || `${entity.display_name || name}s`,
    icon: entity.icon || '📄',
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
  // Prefer a field literally named "name"
  if (entity.fields.some(f => f.name === 'name')) return 'name';
  // Then first searchable text field
  const searchable = entity.fields.find(f => f.searchable && f.type === 'text' && !systemFields.has(f.name));
  if (searchable) return searchable.name;
  // Then first text field
  const textField = entity.fields.find(f => f.type === 'text' && !systemFields.has(f.name));
  if (textField) return textField.name;
  // Then first non-system field
  const firstField = entity.fields.find(f => !systemFields.has(f.name));
  return firstField?.name || 'name';
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

function normalizeAnchor(anchor: Partial<KASAppSpec['anchor']> | undefined, entities: Entity[]): KASAppSpec['anchor'] {
  const defaultEntity = entities[0]?.name || 'Item';
  const anchorEntityName = anchor?.entity || defaultEntity;
  const anchorEntity = entities.find(e => e.name === anchorEntityName) || entities[0];
  const primaryField = findPrimaryTextField(anchorEntity);
  const dateTimeField = anchorEntity?.fields.find(f => f.type === 'datetime' || f.type === 'date');

  // Smart default title: if primary field is a date and entity has belongs_to, use related entity name
  let defaultTitle = `{${primaryField}}`;
  let defaultSubtitle = '';
  if (anchorEntity) {
    const primaryFieldDef = anchorEntity.fields.find(f => f.name === primaryField);
    if (primaryFieldDef && (primaryFieldDef.type === 'date' || primaryFieldDef.type === 'datetime')) {
      const belongsTo = anchorEntity.relationships.find(r => r.type === 'belongs_to');
      if (belongsTo) {
        const parentEntity = entities.find(e => e.name === belongsTo.target);
        if (parentEntity) {
          const parentPrimary = findPrimaryTextField(parentEntity);
          defaultTitle = `{${belongsTo.target.toLowerCase()}.${parentPrimary}}`;
          defaultSubtitle = `{${primaryField}}`;
        }
      }
    }
  }

  const rawTitle = anchor?.card_display?.title || defaultTitle;
  const validatedTitle = validateTemplate(rawTitle, anchorEntity);
  const rawSubtitle = anchor?.card_display?.subtitle || defaultSubtitle;
  const validatedSubtitle = validateTemplate(rawSubtitle, anchorEntity);

  return {
    entity: anchorEntityName,
    type: anchor?.type || 'day_schedule',
    greeting_template: anchor?.greeting_template || 'Good {time_of_day}',
    date_label: anchor?.date_label || 'today',
    card_display: {
      title: validatedTitle,
      subtitle: validatedSubtitle,
      time_field: anchor?.card_display?.time_field || dateTimeField?.name || 'datetime',
      actions: anchor?.card_display?.actions || ['edit', 'delete'],
      ...anchor?.card_display,
      title: validatedTitle,
      subtitle: validatedSubtitle,
    },
    empty_state: {
      message: anchor?.empty_state?.message || 'No items today',
      action: anchor?.empty_state?.action || 'Add an item',
      fallback_view: anchor?.empty_state?.fallback_view || 'calendar',
      ...anchor?.empty_state,
    },
    summary: {
      stats: anchor?.summary?.stats || [
        { label: 'Today', query: 'today_count' },
        { label: 'This Week', query: 'week_count' },
      ],
      ...anchor?.summary,
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
 * Infer add_flows for entities that don't have them.
 * Creates a step-per-field flow for each entity.
 */
function inferAddFlows(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };

  for (const entity of entities) {
    if (result[entity.name]) continue;

    // Skip system fields
    const userFields = entity.fields.filter(f =>
      !['id', 'created_at', 'updated_at', 'archived'].includes(f.name)
    );
    if (userFields.length === 0) continue;

    console.log(`[normalizeSpec] Inferred add_flow for '${entity.name}'`);
    result[entity.name] = {
      steps: userFields.map(f => ({
        field: f.name,
        prompt: `Enter ${f.display_name || f.name}`,
        required: f.required ?? false,
        ...(f.type === 'number' || f.type === 'currency' ? { keyboard: 'numeric' } : {}),
        ...(f.type === 'phone' ? { keyboard: 'phone-pad' } : {}),
        ...(f.type === 'email' ? { keyboard: 'email-address' } : {}),
      })),
    };
  }

  return result;
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

  // Validate display templates reference real fields on source entity
  for (const [key, config] of Object.entries(fixed)) {
    if (!config?.events) continue;
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
        console.log(`[normalizeSpec] Fixed story_events.${key} event display '${ev.display}' → '{${primary}}' for source '${ev.source}'`);
        ev.display = `{${primary}}`;
      }
    }
  }

  return inferStoryEvents(fixed, entities);
}

/**
 * Normalize add_flows: fix array format and ensure {steps} structure.
 */
function normalizeAddFlowsFormat(
  raw: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const fixed: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      console.log(`[normalizeSpec] Fixed add_flows.${key}: array → {steps: [...]}`);
      fixed[key] = { steps: value };
    } else if (value && typeof value === 'object') {
      fixed[key] = value;
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
    anchor: normalizeAnchor(spec.anchor, entities),
    computed_fields: normalizeComputedFields(spec.computed_fields),
    business_rules: spec.business_rules || [],
    story_events: normalizeStoryEventsFormat(spec.story_events || {}, entities),
    add_flows: normalizeAddFlowsFormat(spec.add_flows || {}, entities),
    search: {
      entities: spec.search?.entities || entities.map(e => e.name),
      display: spec.search?.display || Object.fromEntries(
        entities.map(e => [e.name, `{${findPrimaryTextField(e)}}`])
      ),
    },
    calendar: spec.calendar || {
      entity: entities.find(e => e.fields.some(f => f.type === 'datetime' || f.type === 'date'))?.name || entities[0]?.name,
      date_field: entities.find(e => e.fields.some(f => f.type === 'datetime' || f.type === 'date'))
        ?.fields.find(f => f.type === 'datetime' || f.type === 'date')?.name || 'datetime',
      display: '{time}',
    },
    chat_commands: spec.chat_commands || [],
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
