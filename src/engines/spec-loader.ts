/**
 * Spec Loader and Validator
 *
 * Loads raw JSON and validates it against the KASAppSpec contract.
 * Collects ALL errors before returning (never fails on first error).
 */

import type {
  KASAppSpec,
  FieldType,
  ComputedFieldType,
  RelationshipType,
} from '../core/types/spec';

// ──────────────────────────────────────────
// Public types
// ──────────────────────────────────────────

export interface ValidationSuccess {
  success: true;
  spec: KASAppSpec;
}

export interface ValidationFailure {
  success: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────

const VALID_FIELD_TYPES: ReadonlySet<string> = new Set<FieldType>([
  'text', 'number', 'currency', 'phone', 'email', 'choice',
  'date', 'datetime', 'time', 'toggle', 'duration', 'note', 'image',
]);

const VALID_COMPUTED_FIELD_TYPES: ReadonlySet<string> = new Set<ComputedFieldType>([
  'count', 'sum', 'days_since', 'days_until', 'latest', 'formula',
]);

const VALID_RELATIONSHIP_TYPES: ReadonlySet<string> = new Set<RelationshipType>([
  'belongs_to', 'has_many',
]);

const REQUIRED_TOP_LEVEL_SECTIONS = [
  'meta', 'entities', 'anchor', 'computed_fields', 'business_rules',
] as const;

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatFieldTypes(): string {
  return Array.from(VALID_FIELD_TYPES).join(', ');
}

function formatComputedFieldTypes(): string {
  return Array.from(VALID_COMPUTED_FIELD_TYPES).join(', ');
}

// ──────────────────────────────────────────
// Validation steps
// ──────────────────────────────────────────

function validateTopLevel(json: Record<string, unknown>, errors: string[]): void {
  for (const section of REQUIRED_TOP_LEVEL_SECTIONS) {
    if (!(section in json)) {
      errors.push(`Missing required section: ${section}`);
    }
  }
}

function validateMeta(json: Record<string, unknown>, errors: string[]): void {
  if (!('meta' in json)) return;
  const meta = json.meta;
  if (!isRecord(meta)) {
    errors.push("'meta' must be an object");
    return;
  }
  if (typeof meta.spec_id !== 'string') errors.push("meta.spec_id must be a string");
  if (typeof meta.name !== 'string') errors.push("meta.name must be a string");
  if (typeof meta.version !== 'number') errors.push("meta.version must be a number");
}

function validateEntities(json: Record<string, unknown>, errors: string[]): string[] {
  const entityNames: string[] = [];
  if (!('entities' in json)) return entityNames;

  const entities = json.entities;
  if (!Array.isArray(entities)) {
    errors.push("'entities' must be an array");
    return entityNames;
  }
  if (entities.length === 0) {
    errors.push("'entities' must be a non-empty array");
    return entityNames;
  }

  const seenNames = new Set<string>();
  for (const entity of entities) {
    if (!isRecord(entity)) continue;
    const name = entity.name;
    if (typeof name === 'string') {
      if (seenNames.has(name)) {
        errors.push(`Duplicate entity name: '${name}'`);
      } else {
        seenNames.add(name);
        entityNames.push(name);
      }
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!isRecord(entity)) {
      errors.push(`entities[${i}] must be an object`);
      continue;
    }
    const eName = typeof entity.name === 'string' ? entity.name : `entities[${i}]`;
    if (typeof entity.name !== 'string') errors.push(`${eName}: 'name' must be a string`);
    if (!Array.isArray(entity.fields)) errors.push(`Entity '${eName}': 'fields' must be an array`);
    if (!Array.isArray(entity.relationships)) errors.push(`Entity '${eName}': 'relationships' must be an array`);

    if (Array.isArray(entity.fields)) {
      for (let j = 0; j < entity.fields.length; j++) {
        const field = entity.fields[j];
        if (!isRecord(field)) {
          errors.push(`Entity '${eName}': fields[${j}] must be an object`);
          continue;
        }
        const fName = typeof field.name === 'string' ? field.name : `fields[${j}]`;
        if (typeof field.name !== 'string') {
          errors.push(`Entity '${eName}': field ${fName} missing 'name' (string)`);
        }
        if (typeof field.type !== 'string' || !VALID_FIELD_TYPES.has(field.type)) {
          const given = typeof field.type === 'string' ? field.type : String(field.type);
          errors.push(`Entity '${eName}': field '${fName}' has invalid type '${given}'. Valid types: ${formatFieldTypes()}`);
        }
        if (typeof field.required !== 'boolean') {
          errors.push(`Entity '${eName}': field '${fName}' missing 'required' (boolean)`);
        }
      }
    }
  }
  return entityNames;
}

function validateRelationships(json: Record<string, unknown>, entityNames: string[], errors: string[]): void {
  if (!Array.isArray(json.entities)) return;
  const entityNameSet = new Set(entityNames);

  for (const entity of json.entities as Record<string, unknown>[]) {
    if (!isRecord(entity) || !Array.isArray(entity.relationships)) continue;
    const eName = typeof entity.name === 'string' ? entity.name : '(unknown)';

    for (let i = 0; i < entity.relationships.length; i++) {
      const rel = entity.relationships[i];
      if (!isRecord(rel)) {
        errors.push(`Entity '${eName}': relationships[${i}] must be an object`);
        continue;
      }
      if (typeof rel.target !== 'string') {
        errors.push(`Entity '${eName}': relationship[${i}] missing 'target' (string)`);
      } else if (!entityNameSet.has(rel.target)) {
        errors.push(`Entity '${eName}': relationship target '${rel.target}' not found in entities`);
      }
      if (typeof rel.type !== 'string' || !VALID_RELATIONSHIP_TYPES.has(rel.type)) {
        const given = typeof rel.type === 'string' ? rel.type : String(rel.type);
        errors.push(`Entity '${eName}': relationship type '${given}' is invalid. Must be 'belongs_to' or 'has_many'`);
      }
    }
  }
}

function validateAnchor(json: Record<string, unknown>, entityNames: string[], errors: string[]): void {
  if (!('anchor' in json)) return;
  const anchor = json.anchor;
  if (!isRecord(anchor)) {
    errors.push("'anchor' must be an object");
    return;
  }
  if (typeof anchor.entity !== 'string') {
    errors.push("anchor.entity must be a string");
  } else if (!entityNames.includes(anchor.entity)) {
    errors.push(`anchor.entity '${anchor.entity}' not found in entities`);
  }
}

function validateComputedFields(json: Record<string, unknown>, entityNames: string[], errors: string[]): void {
  if (!('computed_fields' in json)) return;
  const cf = json.computed_fields;
  if (!isRecord(cf)) {
    errors.push("'computed_fields' must be an object");
    return;
  }
  const entityNameSet = new Set(entityNames);

  for (const [entityKey, fieldsRaw] of Object.entries(cf)) {
    if (!entityNameSet.has(entityKey)) {
      errors.push(`computed_fields key '${entityKey}' does not match any entity name`);
    }
    if (!Array.isArray(fieldsRaw)) {
      errors.push(`computed_fields['${entityKey}'] must be an array`);
      continue;
    }
    for (let i = 0; i < fieldsRaw.length; i++) {
      const field = fieldsRaw[i];
      if (!isRecord(field)) {
        errors.push(`computed_fields['${entityKey}'][${i}] must be an object`);
        continue;
      }
      const cfName = typeof field.name === 'string' ? field.name : `[${i}]`;
      if (typeof field.name !== 'string') {
        errors.push(`Computed field '${entityKey}'.${cfName}: missing 'name' (string)`);
      }
      if (typeof field.type !== 'string' || !VALID_COMPUTED_FIELD_TYPES.has(field.type)) {
        const given = typeof field.type === 'string' ? field.type : String(field.type);
        errors.push(`Computed field '${entityKey}'.${cfName}: invalid type '${given}'. Valid types: ${formatComputedFieldTypes()}`);
        continue;
      }
      if (field.type === 'formula') {
        if (typeof field.formula !== 'string' || field.formula.trim() === '') {
          errors.push(`Computed field '${entityKey}'.${cfName}: type 'formula' requires a non-empty 'formula' string`);
        }
      }
      const aggregateTypes = new Set(['count', 'sum', 'days_since', 'days_until', 'latest']);
      if (aggregateTypes.has(field.type as string)) {
        if (typeof field.source_entity !== 'string') {
          errors.push(`Computed field '${entityKey}'.${cfName}: type '${field.type}' requires 'source_entity' (string)`);
        } else if (!entityNameSet.has(field.source_entity as string)) {
          errors.push(`Computed field '${entityKey}'.${cfName}: source_entity '${field.source_entity}' not found in entities`);
        }
      }
    }
  }
}

function validateBusinessRules(json: Record<string, unknown>, entityNames: string[], errors: string[]): void {
  if (!('business_rules' in json)) return;
  const rules = json.business_rules;
  if (!Array.isArray(rules)) {
    errors.push("'business_rules' must be an array");
    return;
  }
  const entityNameSet = new Set(entityNames);

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!isRecord(rule)) {
      errors.push(`business_rules[${i}] must be an object`);
      continue;
    }
    const ruleId = typeof rule.id === 'string' ? rule.id : `business_rules[${i}]`;
    if (typeof rule.id !== 'string') errors.push(`Business rule ${ruleId}: missing 'id' (string)`);
    if (typeof rule.entity !== 'string') {
      errors.push(`Business rule '${ruleId}': missing 'entity' (string)`);
    } else if (!entityNameSet.has(rule.entity)) {
      errors.push(`Business rule '${ruleId}': entity '${rule.entity}' not found in entities`);
    }
    if (!isRecord(rule.condition)) errors.push(`Business rule '${ruleId}': missing 'condition' (object)`);
    if (!isRecord(rule.warning)) errors.push(`Business rule '${ruleId}': missing 'warning' (object)`);
  }
}

// ──────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────

export function loadSpec(json: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return { success: false, errors: ['Input must be a non-null object (not array, not primitive)'] };
  }

  validateTopLevel(json, errors);
  validateMeta(json, errors);
  const entityNames = validateEntities(json, errors);
  validateRelationships(json, entityNames, errors);
  validateAnchor(json, entityNames, errors);
  validateComputedFields(json, entityNames, errors);
  validateBusinessRules(json, entityNames, errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true, spec: json as unknown as KASAppSpec };
}
