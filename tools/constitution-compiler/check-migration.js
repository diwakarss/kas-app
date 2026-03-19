#!/usr/bin/env node
/**
 * Migration Safety Checker — KAS App
 *
 * Validates that schema changes follow additive-only rules.
 * For Wave 1, this is a basic check that passes if constitution files exist.
 */

const fs = require('fs');
const path = require('path');

const CONSTITUTION_DIR = path.resolve(__dirname, '../../architecture/constitution');

function checkMigrationSafety() {
  console.log('Checking migration safety...');
  let success = true;

  // Check migration-policy.yaml exists
  const policyPath = path.join(CONSTITUTION_DIR, 'migration-policy.yaml');
  if (fs.existsSync(policyPath)) {
    console.log('  ✓ migration-policy.yaml exists');
  } else {
    console.log('  ✗ migration-policy.yaml not found');
    success = false;
  }

  // Check spec-contract.schema.json exists
  const schemaPath = path.join(CONSTITUTION_DIR, 'spec-contract.schema.json');
  if (fs.existsSync(schemaPath)) {
    console.log('  ✓ spec-contract.schema.json exists');
  } else {
    console.log('  ✗ spec-contract.schema.json not found');
    success = false;
  }

  // For Wave 1: No actual migrations to check yet
  console.log('\n  ℹ No migrations to verify (Wave 1 baseline)');

  console.log('\n' + '='.repeat(40));
  if (success) {
    console.log('✓ Migration safety check passed');
  } else {
    console.log('✗ Migration safety check failed');
  }

  return success;
}

const success = checkMigrationSafety();
process.exit(success ? 0 : 1);
