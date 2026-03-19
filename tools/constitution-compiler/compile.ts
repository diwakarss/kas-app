#!/usr/bin/env npx ts-node
/**
 * Constitution Compiler — KAS App
 *
 * Reads constitution YAML/JSON files and validates:
 * 1. spec-contract.schema.json exists
 * 2. block-boundaries.yaml exists
 * 3. migration-policy.yaml exists
 * 4. Validates tutor-spec.json against schema
 *
 * Usage:
 *   npx ts-node tools/constitution-compiler/compile.ts
 *   npm run validate:spec
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const CONSTITUTION_DIR = path.resolve(__dirname, '../../architecture/constitution');
const SPECS_DIR = path.resolve(__dirname, '../../assets');

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  validated: string[];
}

/**
 * Load and parse YAML constitution file
 */
function loadYaml(filename: string): any {
  const filepath = path.join(CONSTITUTION_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Constitution file not found: ${filename}`);
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return yaml.parse(content);
}

/**
 * Load and parse JSON constitution file
 */
function loadJson(filename: string): any {
  const filepath = path.join(CONSTITUTION_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Constitution file not found: ${filename}`);
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Validate a spec file against the schema
 */
function validateSpec(specPath: string, schema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(specPath)) {
    return { valid: false, errors: [`Spec file not found: ${specPath}`] };
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

  // Check required top-level fields
  const requiredFields = ['meta', 'entities', 'anchor', 'story_events', 'add_flows', 'search'];
  for (const field of requiredFields) {
    if (!(field in spec)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check meta required fields
  if (spec.meta) {
    const requiredMeta = ['spec_id', 'name', 'version', 'business_type', 'created_date'];
    for (const field of requiredMeta) {
      if (!(field in spec.meta)) {
        errors.push(`Missing required meta field: ${field}`);
      }
    }

    // Check spec_id pattern
    if (spec.meta.spec_id && !/^[a-z]+-[a-z]+-[0-9]+$/.test(spec.meta.spec_id)) {
      errors.push(`Invalid spec_id format: ${spec.meta.spec_id} (expected: type-name-number)`);
    }

    // Check version lineage fields (Bridge Gate B5)
    const lineageFields = ['template_family', 'template_version', 'spec_version'];
    for (const field of lineageFields) {
      if (!(field in spec.meta)) {
        errors.push(`Missing version lineage field: meta.${field}`);
      }
    }
  }

  // Check entities
  if (Array.isArray(spec.entities) && spec.entities.length > 0) {
    for (const entity of spec.entities) {
      if (!entity.name || !/^[A-Z][a-zA-Z]*$/.test(entity.name)) {
        errors.push(`Invalid entity name: ${entity.name} (expected PascalCase)`);
      }
      if (!entity.display_name) {
        errors.push(`Entity ${entity.name} missing display_name`);
      }
      if (!entity.display_name_plural) {
        errors.push(`Entity ${entity.name} missing display_name_plural`);
      }
      if (!Array.isArray(entity.fields)) {
        errors.push(`Entity ${entity.name} missing fields array`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Main validation function
 */
async function validate(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    validated: [],
  };

  console.log('Validating constitution files...');

  // Check constitution files exist
  const constitutionFiles = [
    'spec-contract.schema.json',
    'block-boundaries.yaml',
    'migration-policy.yaml',
    'agent-policy.yaml',
  ];

  for (const file of constitutionFiles) {
    const filepath = path.join(CONSTITUTION_DIR, file);
    if (fs.existsSync(filepath)) {
      console.log(`  ✓ ${file}`);
      result.validated.push(file);
    } else {
      console.log(`  ✗ ${file} not found`);
      result.errors.push(`Constitution file missing: ${file}`);
      result.success = false;
    }
  }

  // Load schema
  let schema: any;
  try {
    schema = loadJson('spec-contract.schema.json');
    console.log('\nLoaded spec contract schema');
  } catch (err: any) {
    result.errors.push(`Failed to load schema: ${err.message}`);
    result.success = false;
    return result;
  }

  // Validate spec files
  console.log('\nValidating spec files...');
  const specFiles = ['tutor-spec.json', 'shopkeeper-spec.json'];

  for (const specFile of specFiles) {
    const specPath = path.join(SPECS_DIR, specFile);
    const { valid, errors } = validateSpec(specPath, schema);

    if (valid) {
      console.log(`  ✓ ${specFile}`);
      result.validated.push(specFile);
    } else {
      console.log(`  ✗ ${specFile}`);
      errors.forEach(err => {
        console.log(`      ${err}`);
        result.errors.push(`${specFile}: ${err}`);
      });
      result.success = false;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  if (result.success) {
    console.log(`✓ All validations passed (${result.validated.length} files)`);
  } else {
    console.log(`✗ Validation failed with ${result.errors.length} error(s)`);
  }

  return result;
}

// Run if executed directly
validate().then(result => {
  process.exit(result.success ? 0 : 1);
});

export { validate, loadYaml, loadJson };
