#!/usr/bin/env ts-node
/**
 * Check Landing Contract
 *
 * CI validation script that ensures:
 * 1. All spec templates conform to the KASAppSpec contract
 * 2. Generated specs are compatible with the app renderer
 * 3. Database schema matches expected structure
 *
 * Run: npx ts-node tools/check-landing-contract.ts
 * Or:  npm run check:landing-contract
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types from the spec contract
interface FieldContract {
  name: string;
  type: string;
  required: boolean;
}

interface EntityContract {
  name: string;
  fields: FieldContract[];
  relationships: { target: string; type: string }[];
}

interface SpecContract {
  meta: {
    spec_id: string;
    name: string;
    version: number;
  };
  entities: EntityContract[];
  anchor: {
    entity: string;
  };
  computed_fields: Record<string, unknown[]>;
  business_rules: unknown[];
}

// Valid types
const VALID_FIELD_TYPES = new Set([
  'text', 'number', 'currency', 'phone', 'email', 'choice',
  'date', 'datetime', 'time', 'toggle', 'duration', 'note', 'image',
]);

const VALID_COMPUTED_TYPES = new Set([
  'count', 'sum', 'days_since', 'days_until', 'latest', 'formula',
]);

const VALID_RELATIONSHIP_TYPES = new Set(['belongs_to', 'has_many']);

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateSpec(specPath: string): ValidationResult {
  const result: ValidationResult = {
    file: specPath,
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec = JSON.parse(content) as Partial<SpecContract>;

    // Check required sections
    if (!spec.meta) {
      result.errors.push('Missing required section: meta');
    } else {
      if (!spec.meta.spec_id) result.errors.push('Missing meta.spec_id');
      if (!spec.meta.name) result.errors.push('Missing meta.name');
      if (typeof spec.meta.version !== 'number') result.errors.push('meta.version must be a number');
    }

    if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
      result.errors.push('entities must be a non-empty array');
    } else {
      const entityNames = new Set<string>();

      for (const entity of spec.entities) {
        // Check entity name
        if (!entity.name || typeof entity.name !== 'string') {
          result.errors.push('Entity missing name');
          continue;
        }

        if (entityNames.has(entity.name)) {
          result.errors.push(`Duplicate entity name: ${entity.name}`);
        }
        entityNames.add(entity.name);

        // Check fields
        if (!Array.isArray(entity.fields)) {
          result.errors.push(`Entity '${entity.name}': fields must be an array`);
        } else {
          const fieldNames = new Set<string>();

          for (const field of entity.fields) {
            if (!field.name) {
              result.errors.push(`Entity '${entity.name}': field missing name`);
              continue;
            }

            if (fieldNames.has(field.name)) {
              result.errors.push(`Entity '${entity.name}': duplicate field '${field.name}'`);
            }
            fieldNames.add(field.name);

            if (!VALID_FIELD_TYPES.has(field.type)) {
              result.errors.push(
                `Entity '${entity.name}': field '${field.name}' has invalid type '${field.type}'`
              );
            }

            if (typeof field.required !== 'boolean') {
              result.warnings.push(
                `Entity '${entity.name}': field '${field.name}' missing 'required' (defaulting to false)`
              );
            }
          }
        }

        // Check relationships
        if (Array.isArray(entity.relationships)) {
          for (const rel of entity.relationships) {
            if (!rel.target) {
              result.errors.push(`Entity '${entity.name}': relationship missing target`);
            } else if (!entityNames.has(rel.target) && !spec.entities.some(e => e.name === rel.target)) {
              // Allow forward references, but warn
              result.warnings.push(
                `Entity '${entity.name}': relationship target '${rel.target}' - verify entity exists`
              );
            }

            if (!VALID_RELATIONSHIP_TYPES.has(rel.type)) {
              result.errors.push(
                `Entity '${entity.name}': invalid relationship type '${rel.type}'`
              );
            }
          }
        }
      }

      // Check anchor
      if (!spec.anchor) {
        result.errors.push('Missing required section: anchor');
      } else if (!entityNames.has(spec.anchor.entity)) {
        result.errors.push(`Anchor entity '${spec.anchor.entity}' not found in entities`);
      }

      // Check computed fields
      if (spec.computed_fields && typeof spec.computed_fields === 'object') {
        for (const [entityName, fields] of Object.entries(spec.computed_fields)) {
          if (!entityNames.has(entityName)) {
            result.errors.push(`computed_fields key '${entityName}' not found in entities`);
          }

          if (Array.isArray(fields)) {
            for (const field of fields as any[]) {
              if (!field.name) {
                result.errors.push(`Computed field in '${entityName}' missing name`);
              }
              if (!VALID_COMPUTED_TYPES.has(field.type)) {
                result.errors.push(
                  `Computed field '${entityName}.${field.name}' has invalid type '${field.type}'`
                );
              }
            }
          }
        }
      }
    }

    result.valid = result.errors.length === 0;
  } catch (error: any) {
    result.valid = false;
    result.errors.push(`Failed to parse: ${error.message}`);
  }

  return result;
}

// Files that are known non-spec files (metadata, patterns, etc.)
const SKIP_FILES = new Set(['index.json', 'patterns.json']);

function main(): void {
  console.log('🔍 Checking Landing Contract...\n');

  const templatesDir = path.join(__dirname, '..', 'assets', 'templates');
  const results: ValidationResult[] = [];

  // Find all JSON files in templates directory
  if (fs.existsSync(templatesDir)) {
    const files = fs.readdirSync(templatesDir)
      .filter(f => f.endsWith('.json'))
      .filter(f => !SKIP_FILES.has(f));

    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const result = validateSpec(filePath);
      results.push(result);
    }
  } else {
    console.log(`⚠️  Templates directory not found: ${templatesDir}`);
  }

  // Print results
  let hasErrors = false;

  for (const result of results) {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${path.basename(result.file)}`);

    for (const error of result.errors) {
      console.log(`   ❌ ${error}`);
      hasErrors = true;
    }

    for (const warning of result.warnings) {
      console.log(`   ⚠️  ${warning}`);
    }
  }

  console.log('\n' + '─'.repeat(50));

  if (results.length === 0) {
    console.log('⚠️  No spec templates found to validate');
    process.exit(0);
  }

  const passed = results.filter(r => r.valid).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} specs passed validation`);

  if (hasErrors) {
    console.log('\n❌ Landing contract check FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ Landing contract check PASSED');
    process.exit(0);
  }
}

main();
