/**
 * Extended Spec Validator
 *
 * Extends the base spec-loader validation with:
 * 1. Semantic validation (entity references resolve)
 * 2. Injection detection (SQL, template injection in strings)
 * 3. Business logic validation (anchor entity has date field, etc.)
 *
 * Used for validating LLM-generated specs.
 */

import { loadSpec, ValidationResult } from '../../engines/spec-loader';
import type { KASAppSpec, Entity, Field, Relationship } from '../../core/types/spec';

/**
 * Extended validation result with categorized errors.
 */
export interface ExtendedValidationResult {
  valid: boolean;
  structural_errors: string[];
  semantic_errors: string[];
  injection_warnings: string[];
  business_logic_errors: string[];
}

/**
 * Patterns that might indicate injection attempts.
 */
const INJECTION_PATTERNS = [
  // SQL injection patterns
  /;\s*DROP\s+TABLE/i,
  /;\s*DELETE\s+FROM/i,
  /;\s*INSERT\s+INTO/i,
  /;\s*UPDATE\s+\w+\s+SET/i,
  /'\s*OR\s+'1'\s*=\s*'1/i,
  /--\s*$/,
  /\/\*.*\*\//,

  // Template injection patterns
  /\$\{[^}]+\}/,
  /\{\{[^}]+\}\}/,
  /__proto__/i,
  /constructor\s*\(/i,

  // Path traversal
  /\.\.\//,
  /\.\.\\/,
];

/**
 * Check a string for potential injection patterns.
 */
function checkInjection(value: string, path: string): string[] {
  const warnings: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      warnings.push(`Potential injection detected at ${path}: matches pattern ${pattern}`);
    }
  }

  return warnings;
}

/**
 * Recursively check an object for injection patterns.
 */
function checkObjectForInjection(obj: any, path: string): string[] {
  const warnings: string[] = [];

  if (typeof obj === 'string') {
    warnings.push(...checkInjection(obj, path));
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      warnings.push(...checkObjectForInjection(item, `${path}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      warnings.push(...checkObjectForInjection(value, `${path}.${key}`));
    }
  }

  return warnings;
}

/**
 * Validate semantic correctness of a spec.
 */
function validateSemantics(spec: KASAppSpec): string[] {
  const errors: string[] = [];
  const entityNames = new Set(spec.entities.map((e) => e.name));

  // Check all relationships reference existing entities
  for (const entity of spec.entities) {
    for (const rel of entity.relationships) {
      if (!entityNames.has(rel.target)) {
        errors.push(
          `Entity '${entity.name}': relationship target '${rel.target}' does not exist`
        );
      }
    }
  }

  // Check computed fields reference existing entities
  for (const [entityName, fields] of Object.entries(spec.computed_fields)) {
    if (!entityNames.has(entityName)) {
      errors.push(`Computed fields defined for non-existent entity '${entityName}'`);
      continue;
    }

    for (const field of fields) {
      if (field.source_entity && !entityNames.has(field.source_entity)) {
        errors.push(
          `Computed field '${entityName}.${field.name}': source_entity '${field.source_entity}' does not exist`
        );
      }
    }
  }

  // Check business rules reference existing entities
  for (const rule of spec.business_rules) {
    if (!entityNames.has(rule.entity)) {
      errors.push(`Business rule '${rule.id}': entity '${rule.entity}' does not exist`);
    }
  }

  // Check story events reference existing entities
  for (const [entityName, config] of Object.entries(spec.story_events)) {
    if (!entityNames.has(entityName)) {
      errors.push(`Story events defined for non-existent entity '${entityName}'`);
      continue;
    }

    for (const event of config.events) {
      if (!entityNames.has(event.source)) {
        errors.push(
          `Story event for '${entityName}': source entity '${event.source}' does not exist`
        );
      }
    }
  }

  // Check add flows reference existing entities
  for (const entityName of Object.keys(spec.add_flows)) {
    if (!entityNames.has(entityName)) {
      errors.push(`Add flow defined for non-existent entity '${entityName}'`);
    }
  }

  // Check chat commands reference existing entities
  for (const cmd of spec.chat_commands) {
    if (cmd.action.entity && !entityNames.has(cmd.action.entity)) {
      errors.push(
        `Chat command '${cmd.pattern}': action entity '${cmd.action.entity}' does not exist`
      );
    }
  }

  return errors;
}

/**
 * Validate business logic requirements.
 */
function validateBusinessLogic(spec: KASAppSpec): string[] {
  const errors: string[] = [];

  // Anchor entity must exist
  const anchorEntity = spec.entities.find((e) => e.name === spec.anchor.entity);
  if (!anchorEntity) {
    errors.push(`Anchor entity '${spec.anchor.entity}' does not exist`);
    return errors; // Can't continue validation
  }

  // Anchor entity should have a date/datetime field for scheduling
  const anchorDateFields = anchorEntity.fields.filter(
    (f) => f.type === 'date' || f.type === 'datetime'
  );
  if (anchorDateFields.length === 0 && spec.anchor.type === 'day_schedule') {
    errors.push(
      `Anchor entity '${spec.anchor.entity}' has no date/datetime field for day_schedule anchor type`
    );
  }

  // Calendar entity must have the specified date field
  if (spec.calendar && spec.calendar.entity) {
    const calendarEntity = spec.entities.find((e) => e.name === spec.calendar.entity);
    if (calendarEntity) {
      const dateField = calendarEntity.fields.find((f) => f.name === spec.calendar.date_field);
      if (!dateField) {
        errors.push(
          `Calendar date_field '${spec.calendar.date_field}' does not exist in entity '${spec.calendar.entity}'`
        );
      } else if (dateField.type !== 'date' && dateField.type !== 'datetime') {
        errors.push(
          `Calendar date_field '${spec.calendar.date_field}' must be of type 'date' or 'datetime'`
        );
      }
    }
  }

  // Search entities must exist
  for (const searchEntity of spec.search.entities) {
    if (!spec.entities.some((e) => e.name === searchEntity)) {
      errors.push(`Search entity '${searchEntity}' does not exist`);
    }
  }

  // Each entity should have at least one required field
  for (const entity of spec.entities) {
    const hasRequiredField = entity.fields.some((f) => f.required);
    if (!hasRequiredField) {
      // This is a warning, not an error
      console.warn(`Entity '${entity.name}' has no required fields`);
    }
  }

  return errors;
}

/**
 * Validate a spec with extended checks.
 *
 * @param specJson - The raw JSON spec to validate
 * @returns Extended validation result with categorized errors
 */
export function validateGeneratedSpec(specJson: unknown): ExtendedValidationResult {
  const result: ExtendedValidationResult = {
    valid: true,
    structural_errors: [],
    semantic_errors: [],
    injection_warnings: [],
    business_logic_errors: [],
  };

  // 1. Structural validation via spec-loader
  const structuralResult = loadSpec(specJson);
  if (structuralResult.success === false) {
    result.structural_errors = structuralResult.errors;
    result.valid = false;
    // Can't continue with other validations if structure is invalid
    return result;
  }

  const spec = structuralResult.spec;

  // 2. Injection detection
  result.injection_warnings = checkObjectForInjection(spec, 'spec');
  // Injection warnings don't fail validation by default, but are reported

  // 3. Semantic validation
  result.semantic_errors = validateSemantics(spec);
  if (result.semantic_errors.length > 0) {
    result.valid = false;
  }

  // 4. Business logic validation
  result.business_logic_errors = validateBusinessLogic(spec);
  if (result.business_logic_errors.length > 0) {
    result.valid = false;
  }

  return result;
}

/**
 * Get all errors as a flat list (for simple error reporting).
 */
export function getAllErrors(result: ExtendedValidationResult): string[] {
  return [
    ...result.structural_errors.map((e) => `[Structure] ${e}`),
    ...result.semantic_errors.map((e) => `[Semantic] ${e}`),
    ...result.business_logic_errors.map((e) => `[Logic] ${e}`),
  ];
}

/**
 * Catalog-integrated validation result. The `repaired` spec may have Zod
 * defaults applied and should be used instead of the raw input.
 */
export interface CatalogValidationResult {
  success: boolean;
  repaired?: KASAppSpec;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a spec with catalog-aware checks on top of existing structural,
 * semantic, and business logic validation. Returns warnings for drift that
 * won't crash but may degrade the UI.
 */
function validateWithCatalog(rawSpec: unknown): CatalogValidationResult {
  if (!rawSpec || typeof rawSpec !== 'object') {
    return { success: false, errors: ['Spec must be an object'], warnings: [] };
  }

  const baseResult = validateGeneratedSpec(rawSpec as KASAppSpec);

  if (!baseResult.valid) {
    return {
      success: false,
      errors: getAllErrors(baseResult),
      warnings: baseResult.injection_warnings,
    };
  }

  const spec = rawSpec as KASAppSpec;
  const warnings: string[] = [...baseResult.injection_warnings];

  if (spec.anchor && !spec.anchor.card_display) {
    warnings.push('Anchor missing card_display; spec builders will use minimal defaults');
  }

  for (const entity of spec.entities) {
    for (const rel of entity.relationships) {
      if (rel.type === 'belongs_to' && !spec.story_events[rel.target]) {
        warnings.push(
          `Entity '${rel.target}' is a belongs_to target but has no story_events; ` +
          `Story screen will fall back to defaults`
        );
      }
    }
  }

  return { success: true, repaired: spec, errors: [], warnings };
}

/**
 * Spec Validator Service (namespace export)
 */
export const SpecValidator = {
  validate: validateGeneratedSpec,
  validateWithCatalog,
  getAllErrors,
};
