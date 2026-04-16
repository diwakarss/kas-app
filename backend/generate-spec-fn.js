
/**
 * Generate Spec Edge Function
 *
 * POST /functions/generate-spec
 * Body: { business_name, business_description }
 *
 * Generates a KAS App spec from a business description using DeepInfra LLM.
 * Persists spec to database and streams progress via SSE.
 *
 * Required secrets:
 * - DEEPINFRA_API_KEY: Your DeepInfra API key
 * - INSFORGE_API_KEY: API key for database writes
 */

const PROGRESS_STEPS = [
  { step: 1, message: 'Analyzing business type...', subtitle: 'Understanding your business needs' },
  { step: 2, message: 'Generating entities...', subtitle: 'Creating your data structure' },
  { step: 3, message: 'Building relationships...', subtitle: 'Connecting your business logic' },
  { step: 4, message: 'Validating spec...', subtitle: 'Making sure everything works' },
  { step: 5, message: 'Complete!', subtitle: 'Your app is ready' },
];

// Valid field types
const VALID_FIELD_TYPES = new Set([
  'text', 'number', 'currency', 'phone', 'email', 'choice',
  'date', 'datetime', 'time', 'toggle', 'duration', 'note', 'image'
]);

// ── Humanization helpers ──

/** Convert snake_case or CamelCase to Title Case: "session_date" → "Session Date", "RepairOrder" → "Repair Order" */
function humanize(name) {
  return name
    .replace(/_id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const IRREGULAR_PLURALS = {
  Child: 'Children', Person: 'People', Man: 'Men', Woman: 'Women',
  Class: 'Classes', Address: 'Addresses', Business: 'Businesses',
  Diagnosis: 'Diagnoses', Analysis: 'Analyses', Status: 'Statuses',
  Tooth: 'Teeth', Foot: 'Feet', Goose: 'Geese', Mouse: 'Mice',
  Leaf: 'Leaves', Life: 'Lives', Wife: 'Wives', Knife: 'Knives',
  Shelf: 'Shelves', Half: 'Halves', Self: 'Selves',
  Ox: 'Oxen', Fish: 'Fish', Sheep: 'Sheep', Deer: 'Deer', Species: 'Species',
  Series: 'Series', Attendance: 'Attendance Records',
};

function smartPlural(name) {
  if (IRREGULAR_PLURALS[name]) return IRREGULAR_PLURALS[name];
  if (name.endsWith('y') && !/[aeiou]y$/i.test(name)) return name.slice(0, -1) + 'ies';
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z') || name.endsWith('ch') || name.endsWith('sh'))
    return name + 'es';
  return name + 's';
}

const ICON_MAP = {
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

function inferIcon(entityName) {
  const lower = entityName.toLowerCase();
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return '📄';
}

const PERSON_LIKE_NAMES = new Set([
  'client', 'customer', 'patient', 'member', 'student', 'child', 'kid',
  'pet', 'dog', 'cat', 'animal', 'owner', 'parent', 'employee', 'staff',
  'instructor', 'teacher', 'trainer', 'therapist', 'doctor',
]);

function isPersonLikeEntity(entity) {
  if (PERSON_LIKE_NAMES.has(entity.name.toLowerCase())) return true;
  const fieldNames = new Set((entity.fields || []).map(f => f.name.toLowerCase()));
  return fieldNames.has('name') && (fieldNames.has('email') || fieldNames.has('phone'));
}

const SEARCHABLE_TYPES = new Set(['text', 'email', 'phone']);

/** Default options for common choice field names */
const DEFAULT_CHOICE_OPTIONS = {
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

const METADATA_DATE_PATTERNS = /birth|dob|founded|established|joined|registered|hired|anniversary/i;

function findScheduleDateField(entity) {
  if (!entity) return null;
  const dateFields = entity.fields.filter(f => f.type === 'datetime' || f.type === 'date');
  if (dateFields.length === 0) return null;
  const scheduleDates = dateFields.filter(f => !METADATA_DATE_PATTERNS.test(f.name));
  if (scheduleDates.length > 0) return scheduleDates[0];
  return null;
}

function humanizePrompt(fieldName, entity) {
  if (fieldName.endsWith('_id') && entity) {
    const rel = entity.relationships.find(r => r.foreign_key === fieldName);
    if (rel) return `Select ${humanize(rel.target).toLowerCase()}`;
    return `Select ${humanize(fieldName)}`;
  }
  return `Enter ${humanize(fieldName).toLowerCase()}`;
}

/**
 * Find the primary display text field for an entity.
 */
function findPrimaryTextField(entity) {
  if (!entity) return 'name';
  const systemFields = new Set(['id', 'created_at', 'updated_at', 'archived']);
  if (entity.fields.some(f => f.name === 'name')) return 'name';
  const searchable = entity.fields.find(f => f.searchable && f.type === 'text' && !systemFields.has(f.name));
  if (searchable) return searchable.name;
  const textField = entity.fields.find(f => f.type === 'text' && !systemFields.has(f.name));
  if (textField) return textField.name;
  const firstField = entity.fields.find(f => !systemFields.has(f.name) && !f.name.endsWith('_id'));
  return firstField?.name || 'name';
}

/**
 * Normalize a field by adding default values for missing properties.
 */
function normalizeField(field) {
  // Normalize field type - map invalid types to valid ones
  let fieldType = field.type || 'text';
  if (!VALID_FIELD_TYPES.has(fieldType)) {
    // Map common invalid types to valid ones
    if (['reference', 'relation', 'foreign_key', 'fk', 'id', 'uuid'].includes(fieldType.toLowerCase())) {
      fieldType = 'text'; // References are handled by relationships, not field types
    } else if (['int', 'integer', 'float', 'decimal'].includes(fieldType.toLowerCase())) {
      fieldType = 'number';
    } else if (['bool', 'boolean'].includes(fieldType.toLowerCase())) {
      fieldType = 'toggle';
    } else if (['string', 'varchar'].includes(fieldType.toLowerCase())) {
      fieldType = 'text';
    } else {
      console.warn(`[normalizeField] Invalid field type '${field.type}' for field '${field.name}', defaulting to 'text'`);
      fieldType = 'text';
    }
  }

  const name = field.name || 'unnamed_field';
  const isFK = name.endsWith('_id');

  // Infer options for choice fields that don't have them
  let options = field.options;
  if (fieldType === 'choice' && (!options || options.length === 0)) {
    options = DEFAULT_CHOICE_OPTIONS[name.toLowerCase()];
  }

  return {
    name,
    display_name: field.display_name && field.display_name !== field.name
      ? field.display_name
      : humanize(name),
    type: fieldType,
    required: field.required ?? false,
    searchable: field.searchable || (!isFK && SEARCHABLE_TYPES.has(fieldType)),
    options,
    default_value: field.default_value,
  };
}

/**
 * Normalize a relationship by adding default values for missing properties.
 */
function normalizeRelationship(rel, index) {
  const target = rel.target || `Unknown_${index}`;
  return {
    target,
    type: rel.type || 'belongs_to',
    foreign_key: rel.foreign_key || `${target.toLowerCase()}_id`,
    display_in_story: rel.display_in_story ?? true,
  };
}

/**
 * Normalize an entity by adding default values for missing properties.
 */
function normalizeEntity(entity) {
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
    relationships: (entity.relationships || []).map((rel, i) => normalizeRelationship(rel, i)),
  };
}

/**
 * Infer story_events for entities that are belongs_to targets.
 */
function inferStoryEvents(existing, entities) {
  const result = { ...existing };
  for (const entity of entities) {
    for (const rel of entity.relationships) {
      if (rel.type === 'belongs_to' && !result[rel.target]) {
        const childEntity = entity;
        const parentEntity = entities.find(e => e.name === rel.target);
        if (!parentEntity) continue;
        const dateField = childEntity.fields.find(f => f.type === 'datetime' || f.type === 'date');
        console.log(`[normalizeSpec] Inferred story_events for '${rel.target}' from '${childEntity.name}'`);
        const childPrimary = findPrimaryTextField(childEntity);
        const parentPrimary = findPrimaryTextField(parentEntity);
        const childPrimaryDef = childEntity.fields.find(f => f.name === childPrimary);
        const needsPrefix = childPrimaryDef && (childPrimaryDef.type === 'date' || childPrimaryDef.type === 'datetime' || childPrimaryDef.type === 'number' || childPrimaryDef.type === 'currency');
        const displayTemplate = needsPrefix ? `${childEntity.display_name}: {${childPrimary}}` : `{${childPrimary}}`;
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
 * Fix double-brace templates {{field}} → {field} in any string value recursively.
 */
function fixTemplateSyntax(obj) {
  if (typeof obj === 'string') {
    let s = obj;
    // Fix double braces with simple field: {{field}} → {field}
    s = s.replace(/\{\{(\w+)\}\}/g, '{$1}');
    // Remove double-brace expressions (ternaries, etc): {{expr}} → empty
    s = s.replace(/\{\{[^}]*\}\}/g, '');
    // Fix JS template literals: ${field} → {field}
    s = s.replace(/\$\{(\w+)\}/g, '{$1}');
    // Remove JS expressions in templates: ${expr ? ... : ...} → empty
    s = s.replace(/\$\{[^}]+\}/g, '');
    // Clean up leftover whitespace
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  if (Array.isArray(obj)) return obj.map(fixTemplateSyntax);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = fixTemplateSyntax(v);
    return result;
  }
  return obj;
}

/**
 * Normalize story_events: fix array format and ensure {events} structure.
 */
function normalizeStoryEvents(raw, entities) {
  const fixed = {};
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
    config.events = config.events.filter(ev => {
      if (!ev.source || !ev.relationship) return false;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: source '${ev.source}' not found`);
        return false;
      }
      const hasFK = srcEntity.fields.some(f => f.name === ev.relationship);
      if (!hasFK) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' not found on '${ev.source}'`);
        return false;
      }
      const rel = srcEntity.relationships.find(r => r.foreign_key === ev.relationship);
      if (rel && rel.target !== key) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' on '${ev.source}' points to '${rel.target}', not '${key}'`);
        return false;
      }
      return true;
    });

    // Validate display templates in events reference real, meaningful fields on source entity
    for (const ev of config.events) {
      if (!ev.display || !ev.source) continue;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) continue;
      const srcFields = new Set(srcEntity.fields.map(f => f.name));

      // Check for dot-notation refs (cross-entity) — not supported in event display
      const hasDotRef = /\{[a-zA-Z_]+\.[a-zA-Z_]+\}/.test(ev.display);
      const simplePlaceholders = Array.from(ev.display.matchAll(/\{([a-zA-Z_]\w*)\}/g))
        .filter(m => !ev.display.includes(m[1] + '.'));
      const hasInvalid = simplePlaceholders.some(m => !srcFields.has(m[1]));
      const allFK = simplePlaceholders.length > 0 && simplePlaceholders.every(m => m[1].endsWith('_id'));

      if (hasDotRef || hasInvalid || allFK) {
        const primary = findPrimaryTextField(srcEntity);
        const primaryDef = srcEntity.fields.find(f => f.name === primary);
        const needsPrefix = primaryDef && (primaryDef.type === 'date' || primaryDef.type === 'datetime' || primaryDef.type === 'number' || primaryDef.type === 'currency');
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
      if (!config.coming_up) {
        for (const ev of config.events) {
          const srcEnt = entities.find(e => e.name === ev.source);
          const dateField = srcEnt?.fields.find(f => f.type === 'datetime' || f.type === 'date');
          if (srcEnt && dateField) {
            config.coming_up = {
              source: srcEnt.name,
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

  return inferStoryEvents(fixed, entities);
}

/**
 * Normalize add_flows: fix array format and ensure {steps} structure.
 */
function normalizeAddFlows(raw, entities) {
  const fixed = {};

  // Handle LLM returning add_flows as an array instead of object
  const entries = Array.isArray(raw)
    ? raw.map((flow, i) => [flow.entity || `flow_${i}`, flow])
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
 * Infer add_flows for entities that don't have them.
 */
function inferAddFlows(existing, entities) {
  const result = { ...existing };
  for (const entity of entities) {
    if (result[entity.name]) continue;
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
      })),
    };
  }

  // Infer after_add flows: after adding a parent entity, suggest adding a child
  for (const entity of entities) {
    const flow = result[entity.name];
    if (!flow || flow.after_add) continue;
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

  return result;
}

/**
 * Normalize a spec by filling in defaults for all missing fields.
 */
function normalizeSpec(spec) {
  // Normalize entities first (needed for other sections)
  const entities = (spec.entities || []).map(normalizeEntity);

  // Get entity names for validation
  const entityNames = new Set(entities.map(e => e.name));

  // Filter relationships — try fuzzy match before removing
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

  // Infer missing relationships from *_id fields
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
        });
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

  const defaultEntity = entities[0]?.name || 'Item';

  // Find the anchor entity and a schedule date field within it
  let anchorEntityName = spec.anchor?.entity || defaultEntity;
  let anchorEntity = entities.find(e => e.name === anchorEntityName) || entities[0];

  // Auto-swap: if anchor entity is person-like with no schedule date,
  // prefer an activity entity (has belongs_to + datetime) for a better day-schedule view
  if (anchorEntity && isPersonLikeEntity(anchorEntity) && !findScheduleDateField(anchorEntity)) {
    const activityEntity = entities.find(e =>
      e.name !== anchorEntity.name &&
      e.relationships.some(r => r.type === 'belongs_to') &&
      findScheduleDateField(e) !== null
    );
    if (activityEntity) {
      console.log(`[normalizeSpec] Anchor swap: '${anchorEntityName}' (person, no date) → '${activityEntity.name}' (activity with date)`);
      anchorEntityName = activityEntity.name;
      anchorEntity = activityEntity;
    }
  }

  const dateTimeField = findScheduleDateField(anchorEntity);
  const timeFieldName = dateTimeField?.name || null;

  // Validate template references exist on the entity and are meaningful display fields
  function validateTemplate(template, entity) {
    if (!entity || !template) return template;
    const fieldNames = new Set(entity.fields.map(f => f.name));
    // Match simple refs {field} but not dot-notation {entity.field} (those are cross-entity)
    const simplePlaceholders = Array.from(template.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g))
      .filter(m => !m[0].includes('.') && !template.includes(`{${m[0]}.`));
    const specialTokens = new Set(['time_of_day', 'time']);

    // Allow templates with dot-notation (cross-entity refs) to pass through
    if (template.match(/\{[a-zA-Z_]+\.[a-zA-Z_]+\}/)) return template;

    // Check for invalid refs
    const hasInvalid = simplePlaceholders.some(m => !fieldNames.has(m[1]) && !specialTokens.has(m[1]));
    // Check if all refs are FK fields (not meaningful for display)
    const allFK = simplePlaceholders.length > 0 && simplePlaceholders
      .filter(m => !specialTokens.has(m[1]))
      .every(m => m[1].endsWith('_id'));

    if (hasInvalid || allFK) {
      const primary = findPrimaryTextField(entity);
      console.log(`[normalizeSpec] Template '${template}' has ${hasInvalid ? 'invalid' : 'FK-only'} refs for '${entity.name}', using '{${primary}}'`);
      return `{${primary}}`;
    }
    return template;
  }

  const primaryField = findPrimaryTextField(anchorEntity);

  // If the primary field is a date/datetime field and entity has a belongs_to,
  // use the related entity's name as title for better display
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
          console.log(`[normalizeSpec] Anchor title: using related ${belongsTo.target}.${parentPrimary} instead of date field`);
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
          defaultSubtitle = `{${primaryField}}`;
          console.log(`[normalizeSpec] Anchor title Phase B: using person-like ${bt.target}.${parentPrimary}`);
          break;
        }
      }
    }
  }

  const rawTitle = spec.anchor?.card_display?.title || defaultTitle;
  const validatedTitle = validateTemplate(rawTitle, anchorEntity);
  const rawSubtitle = spec.anchor?.card_display?.subtitle || defaultSubtitle;
  const validatedSubtitle = validateTemplate(rawSubtitle, anchorEntity);

  return {
    meta: {
      spec_id: spec.meta?.spec_id || crypto.randomUUID(),
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
    anchor: {
      entity: anchorEntityName,
      type: spec.anchor?.type || 'day_schedule',
      greeting_template: spec.anchor?.greeting_template || 'Good {time_of_day}, {business_name}',
      date_label: spec.anchor?.date_label || 'today',
      card_display: {
        ...(spec.anchor?.card_display || {}),
        title: validatedTitle,
        subtitle: validatedSubtitle,
        time_field: spec.anchor?.card_display?.time_field || timeFieldName || null,
        actions: spec.anchor?.card_display?.actions || ['edit', 'delete'],
      },
      empty_state: {
        message: spec.anchor?.empty_state?.message || 'No items today',
        action: spec.anchor?.empty_state?.action || 'Add an item',
        fallback_view: spec.anchor?.empty_state?.fallback_view || 'calendar',
        ...(spec.anchor?.empty_state || {}),
      },
      summary: {
        stats: spec.anchor?.summary?.stats || [
          { label: 'Today', query: 'today_count' },
          { label: 'This Week', query: 'week_count' },
        ],
        ...(spec.anchor?.summary || {}),
      },
    },
    computed_fields: spec.computed_fields || {},
    business_rules: spec.business_rules || [],
    story_events: normalizeStoryEvents(spec.story_events || {}, entities),
    add_flows: normalizeAddFlows(spec.add_flows || {}, entities),
    search: {
      entities: spec.search?.entities || entities.map(e => e.name),
      display: (() => {
        const raw = spec.search?.display || {};
        const display = {};
        for (const e of entities) {
          const tmpl = raw[e.name] || `{${findPrimaryTextField(e)}}`;
          display[e.name] = validateTemplate(tmpl, e);
        }
        return display;
      })(),
    },
    calendar: spec.calendar || (() => {
      const calEntity = entities.find(e => findScheduleDateField(e) !== null) || entities[0];
      const calDateField = findScheduleDateField(calEntity);
      return {
        entity: calEntity?.name || entities[0]?.name,
        date_field: calDateField?.name || 'date',
        display: `{${findPrimaryTextField(calEntity)}}`,
      };
    })(),
    chat_commands: spec.chat_commands || [],
  };
}

const SYSTEM_PROMPT = `You are an expert app specification generator. Given a business description, generate a complete KAS App specification in JSON format.

The spec must include:
- meta: { spec_id (UUID), name, version: 1 }
- entities: Array of entities with fields and relationships
- anchor: { entity: "main activity entity name" }
- story_events: Timeline configs for entities that have children
- add_flows: Step-by-step flows for adding records
- computed_fields: {} (can be empty)
- business_rules: [] (can be empty)

Field types: text, number, currency, phone, email, choice, date, datetime, time, toggle, duration, note, image
Relationship types: belongs_to, has_many

Generate 3-5 entities. Each entity should have 3-6 relevant fields.

RELATIONSHIPS ARE CRITICAL:
- Activity entities MUST have a belongs_to relationship to the person entity.
- Add a foreign key field (e.g. "client_id" with type "number") in the activity entity's fields array.
- The relationship must have: {"target": "ExactEntityName", "type": "belongs_to", "foreign_key": "person_entity_id", "display_in_story": true}
- Use the EXACT entity name in the target field (case-sensitive match).

STORY_EVENTS ARE REQUIRED for every entity that is a belongs_to target:
- story_events["Client"] should show Classes, Payments, etc. that belong to a Client.
- Each event: { source, relationship (FK field name), type, display (template), icon_color }

ADD_FLOWS ARE REQUIRED for at least the main activity entity:
- Each step: { field: "field_name", prompt: "Enter ...", required: true/false }

ANCHOR CARD DISPLAY:
- anchor.card_display.title MUST show the person/subject name using cross-entity ref syntax.
  For activity entities that belong_to a person, use: title: "{person_entity.name}"
  Example: title: "{client.name}", subtitle: "{description}"
- Activity entities (appointments, sessions, orders, jobs) MUST have a "status" choice field
  with options: ["Scheduled", "In Progress", "Completed", "Cancelled"]
- For appointment/session entities, use "datetime" type (not "date") for the scheduling field
  so the time of day is captured.
- For orders/invoices that need line items, create a simple child entity (e.g., OrderItem belongs_to Order)
  with fields like item_name, quantity, price. Do NOT create many-to-many junction tables.

Respond with ONLY valid JSON, no markdown or explanation.`;

// Internal API base URL (use Docker service name for internal calls)
const API_BASE = 'http://insforge:7130';

// Database helper functions
async function createAppInstance(dbApiKey, businessName, businessDescription, businessType) {
  const response = await fetch(`${API_BASE}/api/database/records/app_instance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dbApiKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify([{
      name: businessName,
      business_description: businessDescription,
      business_type: businessType || null,
      current_version: 1,
    }]),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create app_instance: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

async function createSpecVersion(dbApiKey, appInstanceId, version, specJson) {
  const specHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(specJson))
  ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

  const response = await fetch(`${API_BASE}/api/database/records/spec_version`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dbApiKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify([{
      app_instance_id: appInstanceId,
      version: version,
      spec_json: specJson,
      spec_hash: specHash,
    }]),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create spec_version: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

async function createGenerationRun(dbApiKey, appInstanceId, businessName, businessDescription, latencyMs, inputTokens, outputTokens, success, errorMessage) {
  const response = await fetch(`${API_BASE}/api/database/records/generation_run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dbApiKey}`,
    },
    body: JSON.stringify([{
      app_instance_id: appInstanceId,
      business_name: businessName,
      business_description: businessDescription,
      latency_ms: latencyMs,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      success: success,
      error_message: errorMessage,
    }]),
  });

  if (!response.ok) {
    console.error('Failed to create generation_run:', await response.text());
    // Don't throw - audit logging failure shouldn't block the response
  }
}

async function generateWithDeepInfra(businessName, businessDescription, apiKey) {
  const startTime = Date.now();

  const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Generate a KAS App specification for: "${businessName}"\n\nBusiness description: ${businessDescription}` },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepInfra API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from LLM');
  }

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.split('```json')[1].split('```')[0];
  } else if (content.includes('```')) {
    jsonStr = content.split('```')[1].split('```')[0];
  }

  const rawSpec = JSON.parse(jsonStr.trim());

  // Normalize the spec to fill in missing defaults
  const spec = normalizeSpec(rawSpec);
  console.log('[generate-spec] Spec normalized with defaults');

  return {
    spec,
    latencyMs,
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

module.exports = async function (request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const businessName = body.business_name || body.businessName;
  const businessDescription = body.business_description || body.businessDescription;

  if (!businessName?.trim()) {
    return new Response(JSON.stringify({ error: 'business_name is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!businessDescription?.trim()) {
    return new Response(JSON.stringify({ error: 'business_description is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('DEEPINFRA_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'DEEPINFRA_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const dbApiKey = Deno.env.get('INSFORGE_API_KEY');
  if (!dbApiKey) {
    return new Response(JSON.stringify({ error: 'INSFORGE_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if SSE streaming is requested
  const acceptHeader = request.headers.get('Accept') || '';
  const useSSE = acceptHeader.includes('text/event-stream');

  if (useSSE) {
    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let appInstanceId = null;

        try {
          // Step 1: Analyzing business type (2 seconds)
          sendEvent({ type: 'progress', ...PROGRESS_STEPS[0] });
          await new Promise(r => setTimeout(r, 2000));

          // Step 2: Generating entities (start LLM call)
          sendEvent({ type: 'progress', ...PROGRESS_STEPS[1] });

          // Generate spec (this takes 15-30 seconds with the LLM)
          const result = await generateWithDeepInfra(businessName, businessDescription, apiKey);

          // Step 3: Building relationships (2 seconds) - also save to DB
          sendEvent({ type: 'progress', ...PROGRESS_STEPS[2] });

          // Create app_instance
          const appInstance = await createAppInstance(
            dbApiKey,
            businessName,
            businessDescription,
            result.spec.meta.business_type || null
          );
          appInstanceId = appInstance.id;

          // Create spec_version
          await createSpecVersion(dbApiKey, appInstanceId, 1, result.spec);

          await new Promise(r => setTimeout(r, 1000));

          // Step 4: Validating spec (2 seconds)
          sendEvent({ type: 'progress', ...PROGRESS_STEPS[3] });
          await new Promise(r => setTimeout(r, 2000));

          // Log successful generation
          await createGenerationRun(
            dbApiKey,
            appInstanceId,
            businessName,
            businessDescription,
            result.latencyMs,
            result.usage.inputTokens,
            result.usage.outputTokens,
            true,
            null
          );

          // Step 5: Complete (1 second before sending result)
          sendEvent({ type: 'progress', ...PROGRESS_STEPS[4] });
          await new Promise(r => setTimeout(r, 1000));

          // Send complete with spec - use app_instance ID as the specId
          sendEvent({
            type: 'complete',
            specId: appInstanceId,
            spec: result.spec,
          });

          controller.close();
        } catch (error) {
          // Log failed generation
          await createGenerationRun(
            dbApiKey,
            appInstanceId,
            businessName,
            businessDescription,
            null,
            null,
            null,
            false,
            error.message
          );

          sendEvent({
            type: 'error',
            error: error.message || 'Generation failed',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } else {
    // JSON response
    try {
      const result = await generateWithDeepInfra(businessName, businessDescription, apiKey);

      // Create app_instance
      const appInstance = await createAppInstance(
        dbApiKey,
        businessName,
        businessDescription,
        result.spec.meta.business_type || null
      );

      // Create spec_version
      await createSpecVersion(dbApiKey, appInstance.id, 1, result.spec);

      // Log successful generation
      await createGenerationRun(
        dbApiKey,
        appInstance.id,
        businessName,
        businessDescription,
        result.latencyMs,
        result.usage.inputTokens,
        result.usage.outputTokens,
        true,
        null
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            specId: appInstance.id,
            spec: result.spec,
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      // Log failed generation
      await createGenerationRun(
        dbApiKey,
        null,
        businessName,
        businessDescription,
        null,
        null,
        null,
        false,
        error.message
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Generation failed',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }
};

