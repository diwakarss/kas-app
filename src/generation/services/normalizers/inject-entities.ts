/**
 * Domain-entity injection.
 *
 * Some business types (dispatch services, pet services) consistently miss
 * a key entity in the LLM output — a Property/Home for dispatch verticals,
 * a Pet for pet-care verticals — and packing the address or animal into
 * the activity entity is structurally wrong. This stage detects the
 * vertical from the spec haystack and, when a key entity is missing,
 * injects a stub one with sensible defaults plus the activity FK.
 *
 * Runs after entity-shape normalization but before relationship validation
 * so injected relationships pass through the same fix-up pipeline.
 */

import type { Entity, Relationship } from '../../../core/types/spec';
import { humanize, smartPlural, inferIcon } from './shared';
import { classifyEntityRole, isPersonLikeEntity } from './roles';
import { normalizeEntity } from './entity';

type InjectionRule = {
  /** Stable id for logging. */
  id: string;
  /** Regex over entity + field names. If matched, we consider injecting. */
  haystackMatch: RegExp;
  /** Skip injection if any existing entity name matches this. */
  alreadyPresent: RegExp;
  /** Build the new entity. */
  build(personEntity: Entity): Partial<Entity>;
  /** Field name to add to activity entities (e.g. property_id, pet_id). */
  fkField: string;
};

const RULES: InjectionRule[] = [
  {
    id: 'property',
    // Dispatch verticals: services that travel to the customer.
    // Loose prefix match — "cleaner" matches "clean", "plumber" matches "plumb".
    haystackMatch: /\b(clean|landscap|lawn|mow|prun|plumb|electric|hvac|pest|dispatch|walker|walking|mobile|on[-\s]?site|in[-\s]?home|\bhomes\b|house\s+(cleaning|service))/i,
    alreadyPresent: /^(property|home|location|site|address|residence|venue|premise|propertyaddress|serviceaddress)$/i,
    build: (person) => ({
      name: 'Property',
      display_name: 'Property',
      display_name_plural: 'Properties',
      icon: '🏠',
      fields: [
        { name: 'label', display_name: 'Label', type: 'text', required: false, searchable: true },
        { name: 'address', display_name: 'Address', type: 'text', required: true, searchable: true },
        { name: 'access_notes', display_name: 'Access Notes', type: 'note', required: false, searchable: false },
        { name: 'gate_code', display_name: 'Gate Code', type: 'text', required: false, searchable: false },
        { name: `${person.name.toLowerCase()}_id`, display_name: person.display_name, type: 'number', required: true, searchable: false },
      ],
      relationships: [
        { target: person.name, type: 'belongs_to', foreign_key: `${person.name.toLowerCase()}_id`, display_in_story: true },
      ],
    }),
    fkField: 'property_id',
  },
  {
    id: 'pet',
    // Pet verticals: animal subjects belonging to a human owner.
    haystackMatch: /\b(pet|dog|cat|animal|kennel|groomer|grooming|vet|veterinar|walker|walking|boarding|kitten|puppy|paw|pawfect)/i,
    alreadyPresent: /^(pet|dog|cat|animal|patient_animal|petprofile)$/i,
    build: (person) => ({
      name: 'Pet',
      display_name: 'Pet',
      display_name_plural: 'Pets',
      icon: '🐾',
      fields: [
        { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
        { name: 'species', display_name: 'Species', type: 'choice', required: false, searchable: false, options: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'] },
        { name: 'breed', display_name: 'Breed', type: 'text', required: false, searchable: false },
        { name: 'notes', display_name: 'Notes', type: 'note', required: false, searchable: false },
        { name: `${person.name.toLowerCase()}_id`, display_name: person.display_name, type: 'number', required: true, searchable: false },
      ],
      relationships: [
        { target: person.name, type: 'belongs_to', foreign_key: `${person.name.toLowerCase()}_id`, display_in_story: true },
      ],
    }),
    fkField: 'pet_id',
  },
];

function buildHaystack(entities: Entity[], extra: string): string {
  const names = entities.map(e => e.name.toLowerCase());
  const fields = entities.flatMap(e => e.fields.map(f => f.name.toLowerCase()));
  return [extra.toLowerCase(), ...names, ...fields].join(' ');
}

/**
 * Inject Property/Pet entities when the vertical strongly implies them
 * but the LLM didn't emit them. Returns a new entities array.
 *
 * `businessHint` is a freeform string (typically meta.name) used in addition
 * to entity/field names for vertical detection — covers cases like
 * "Evergreen Landscapes" where the keyword never reaches entity names.
 */
export function injectMissingDomainEntities(entities: Entity[], businessHint = ''): Entity[] {
  if (entities.length === 0) return entities;

  // Pet rule should match before walker/walking pulls in Property — but
  // pet services *also* dispatch to customer homes, so both can apply.
  // We run rules in declaration order and short-circuit per-rule.
  const haystack = buildHaystack(entities, businessHint);
  let working = entities.slice();

  for (const rule of RULES) {
    if (!rule.haystackMatch.test(haystack)) continue;
    const exists = working.some(e => rule.alreadyPresent.test(e.name));
    if (exists) continue;

    const personEntity = working.find(e => isPersonLikeEntity(e));
    if (!personEntity) {
      console.log(`[normalizeSpec] inject-entities: rule '${rule.id}' matched but no person entity — skipping`);
      continue;
    }

    const draft = rule.build(personEntity);
    const injected = normalizeEntity(draft);
    working.push(injected);
    console.log(`[normalizeSpec] Injected '${injected.name}' entity (rule: ${rule.id}, owner: ${personEntity.name})`);

    // Add FK from each activity entity to the new entity.
    // Only add to entities that already belongs_to the person — those are
    // the ones doing work for that customer's pet/property.
    for (const ent of working) {
      if (ent === injected) continue;
      const role = classifyEntityRole(ent);
      if (role !== 'activity' && role !== 'document') continue;
      const ownsPerson = ent.relationships.some(r => r.type === 'belongs_to' && r.target === personEntity.name);
      if (!ownsPerson) continue;
      const hasFK = ent.fields.some(f => f.name === rule.fkField);
      if (hasFK) continue;

      ent.fields.push({
        name: rule.fkField,
        display_name: humanize(rule.fkField),
        type: 'number',
        required: false,
        searchable: false,
      } as any);
      ent.relationships.push({
        target: injected.name,
        type: 'belongs_to',
        foreign_key: rule.fkField,
        display_in_story: true,
      } as Relationship);
      console.log(`[normalizeSpec] Wired '${ent.name}.${rule.fkField}' → '${injected.name}'`);
    }
  }

  return working;
}
