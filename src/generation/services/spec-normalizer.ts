/**
 * Spec Normalizer — orchestrator.
 *
 * Takes a partial LLM-generated spec and runs it through the normalizer
 * pipeline so the result satisfies the KASAppSpec contract. Stages live in
 * `./normalizers/` and are composed here.
 *
 * Stage order (mutations noted explicitly):
 *   1. entity/field/relationship shape         — normalizeEntity
 *   2. relationship target validation          — (mutation: fuzzy-fix or drop)
 *   3. relationship inference from *_id fields — (mutation: push inferred rels)
 *   4. role-aware status taxonomy              — normalizeStatusForRole (mutation)
 *   5. anchor + calendar realignment           — normalizeAnchor
 *   6. computed fields + balance_due injection — normalizeComputedFields → injectBalanceDue
 *   7. story_events + balance_due stats        — normalizeStoryEventsFormat → injectBalanceDueStats
 *   8. add_flows + FK picker injection         — normalizeAddFlowsFormat
 *   9. search + chat command inference         — inferChatCommands
 */

import type { KASAppSpec, Entity, Relationship } from '../../core/types/spec';

import { findPrimaryTextField, findScheduleDateField, validateTemplate } from './normalizers/shared';
import { classifyEntityRole, type EntityRole } from './normalizers/roles';
import {
  normalizeEntity,
  normalizeField,
  normalizeRelationship,
  normalizeStatusForRole,
} from './normalizers/entity';
import { normalizeAnchor } from './normalizers/anchor';
import { injectMissingDomainEntities } from './normalizers/inject-entities';
import {
  normalizeStoryEventsFormat,
  injectBalanceDueStats,
} from './normalizers/story-events';
import {
  normalizeAddFlowsFormat,
  inferChatCommands,
} from './normalizers/add-flows';
import { normalizeComputedFields, injectBalanceDue } from './normalizers/money';

// Re-export role types for consumers that classify outside the normalizer.
export { classifyEntityRole, type EntityRole };

/**
 * Normalize a spec by filling in defaults for all missing fields.
 *
 * @param spec - The raw spec from LLM
 * @returns Normalized spec with all required fields populated
 */
export function normalizeSpec(spec: Partial<KASAppSpec>): KASAppSpec {
  // 1. Entity/field/relationship shape
  let entities = (spec.entities || []).map(normalizeEntity);

  // 1b. Domain-entity injection (Property for dispatch verticals, Pet for
  // pet-care verticals). Runs before relationship validation so injected
  // FKs flow through the same fix-up pipeline. Pass meta.name so verticals
  // like "Evergreen Landscapes" detect even when entity names don't carry
  // the keyword.
  entities = injectMissingDomainEntities(entities, spec.meta?.name || '');
  const entityNames = new Set(entities.map(e => e.name));

  // 2. Filter relationships to only reference existing entities
  for (const entity of entities) {
    entity.relationships = entity.relationships.filter(rel => {
      if (!entityNames.has(rel.target)) {
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

  // 3. Infer missing relationships from *_id fields
  for (const entity of entities) {
    const existingTargets = new Set(entity.relationships.map(r => r.target));
    for (const field of entity.fields) {
      if (!field.name.endsWith('_id')) continue;
      const candidateName = field.name.replace(/_id$/, '');
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

  // 4. Role-aware status taxonomy — injects/repairs status on payment,
  // account, document entities; leaves person/container/record alone.
  for (const entity of entities) {
    normalizeStatusForRole(entity);
  }

  // 5. Anchor + calendar realignment
  const normalizedAnchor = normalizeAnchor(spec.anchor, entities);

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

  // 6. Computed fields + balance_due injection
  const computedFields = injectBalanceDue(entities, normalizeComputedFields(spec.computed_fields));

  // 7. Story events + balance_due stats surface
  const storyEvents = injectBalanceDueStats(
    normalizeStoryEventsFormat(spec.story_events || {}, entities),
    computedFields
  );

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
    computed_fields: computedFields,
    business_rules: spec.business_rules || [],
    story_events: storyEvents,
    // 8. Add flows + FK picker injection
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
    // 9. Chat command inference
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
