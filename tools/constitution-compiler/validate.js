#!/usr/bin/env node
/**
 * Constitution Validator — KAS App
 *
 * Validates constitution files and spec.json files.
 * Used by npm run validate:spec
 */

const fs = require('fs');
const path = require('path');

const CONSTITUTION_DIR = path.resolve(__dirname, '../../architecture/constitution');
const SPECS_DIR = path.resolve(__dirname, '../../assets');

/**
 * Validate a spec file against basic requirements
 */
function validateSpec(specPath) {
  const errors = [];

  if (!fs.existsSync(specPath)) {
    return { valid: false, errors: [`Spec file not found: ${specPath}`] };
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e.message}`] };
  }

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
function validate() {
  let success = true;
  const validated = [];
  const allErrors = [];

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
      validated.push(file);
    } else {
      console.log(`  ✗ ${file} not found`);
      allErrors.push(`Constitution file missing: ${file}`);
      success = false;
    }
  }

  // Validate spec files
  console.log('\nValidating spec files...');
  const specFiles = ['tutor-spec.json', 'shopkeeper-spec.json'];

  for (const specFile of specFiles) {
    const specPath = path.join(SPECS_DIR, specFile);
    const { valid, errors } = validateSpec(specPath);

    if (valid) {
      console.log(`  ✓ ${specFile}`);
      validated.push(specFile);
    } else {
      console.log(`  ✗ ${specFile}`);
      errors.forEach(err => {
        console.log(`      ${err}`);
        allErrors.push(`${specFile}: ${err}`);
      });
      success = false;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  if (success) {
    console.log(`✓ All validations passed (${validated.length} files)`);
  } else {
    console.log(`✗ Validation failed with ${allErrors.length} error(s)`);
  }

  return success;
}

// Run
const success = validate();
process.exit(success ? 0 : 1);
