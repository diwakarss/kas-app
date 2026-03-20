#!/usr/bin/env npx ts-node
/**
 * Test Qwen-powered spec generation via DeepInfra
 *
 * Usage:
 *   DEEPINFRA_API_KEY=your-key npx ts-node tools/test-qwen-generation.ts
 *
 * Models used:
 *   - Qwen3-30B-A3B ($0.08/$0.28) - fast, for simple scaffolding
 *   - Qwen3-235B-A22B-Instruct-2507 ($0.071/$0.10) - for complex generation
 */

import { SpecGenerator } from '../src/generation/services/spec-generator';
import {
  DeepInfraProvider,
  DEEPINFRA_MODELS,
} from '../src/generation/providers/deepinfra-provider';
import { validateGeneratedSpec } from '../src/generation/services/spec-validator';

async function main() {
  console.log('=== Wave 3 DeepInfra/Qwen Generation Test ===\n');

  // Check environment
  const apiKey = process.env.DEEPINFRA_API_KEY;

  if (!apiKey) {
    console.error('❌ Missing DEEPINFRA_API_KEY environment variable');
    console.error('\nUsage:');
    console.error('   DEEPINFRA_API_KEY=xxx npx ts-node tools/test-qwen-generation.ts');
    process.exit(1);
  }

  console.log('Models:');
  console.log(`  Fast:    ${DEEPINFRA_MODELS.FAST} ($0.08/$0.28 per 1M)`);
  console.log(`  Capable: ${DEEPINFRA_MODELS.CAPABLE} ($0.071/$0.10 per 1M)`);
  console.log('');

  // Create provider
  const provider = new DeepInfraProvider({ api_key: apiKey });

  const generator = new SpecGenerator({
    llmProvider: provider,
    allowFreshGeneration: true,
  });

  // Test 1: Template-based (should NOT use LLM)
  console.log('--- Test 1: Template Match (tutor) ---');
  const result1 = await generator.generate({
    business_type: 'tutor',
    business_name: "Ravi's Piano Academy",
  });

  if (result1.success) {
    console.log('✅ Success via template');
    console.log(`   Source: ${result1.source}`);
    console.log(`   Template: ${result1.template_used}`);
    console.log(`   Entities: ${result1.spec.entities.map((e) => e.name).join(', ')}`);
  } else {
    console.log('❌ Failed:', result1.errors);
  }
  console.log('');

  // Test 2: Simple scaffolding with FAST model
  console.log('--- Test 2: Simple Scaffolding (florist) - FAST model ---');
  provider.setModelTier('fast');
  console.log(`Using: ${provider.getCurrentModel()}`);
  console.log('Calling LLM...');

  const start2 = Date.now();
  const result2 = await generator.generate({
    business_type: 'florist',
    business_name: "Rosa's Flower Shop",
  });
  const elapsed2 = ((Date.now() - start2) / 1000).toFixed(1);

  if (result2.success) {
    console.log(`✅ Success via LLM (${elapsed2}s)`);
    console.log(`   Source: ${result2.source}`);
    console.log(`   Entities: ${result2.spec.entities.map((e) => e.name).join(', ')}`);
    console.log(`   Anchor: ${result2.spec.anchor.entity}`);

    const validation = validateGeneratedSpec(result2.spec);
    console.log(`   Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);
    if (!validation.valid) {
      console.log('   Errors:', [
        ...validation.structural_errors,
        ...validation.semantic_errors,
        ...validation.business_logic_errors,
      ]);
    }

    // Estimate cost
    const info = provider.getModelInfo();
    const inputCost = 2 * (info.cost_per_1k_input ?? 0); // ~2K prompt
    const outputCost = 4 * (info.cost_per_1k_output ?? 0); // ~4K output
    console.log(`   Est. cost: $${(inputCost + outputCost).toFixed(4)}`);
  } else {
    console.log(`❌ Failed (${elapsed2}s):`, result2.errors);
  }
  console.log('');

  // Test 3: Complex generation with CAPABLE model
  console.log('--- Test 3: Complex Generation (restaurant) - CAPABLE model ---');
  provider.setModelTier('capable');
  console.log(`Using: ${provider.getCurrentModel()}`);
  console.log('Calling LLM...');

  const start3 = Date.now();
  const result3 = await generator.generate({
    business_type: 'restaurant',
    business_name: 'Spice Garden Indian Cuisine',
    features: [
      'table reservations',
      'menu management',
      'order tracking',
      'kitchen display',
      'delivery integration',
      'loyalty program',
    ],
  });
  const elapsed3 = ((Date.now() - start3) / 1000).toFixed(1);

  if (result3.success) {
    console.log(`✅ Success via LLM (${elapsed3}s)`);
    console.log(`   Source: ${result3.source}`);
    console.log(`   Entities: ${result3.spec.entities.map((e) => e.name).join(', ')}`);
    console.log(`   Anchor: ${result3.spec.anchor.entity}`);
    console.log(`   Business rules: ${result3.spec.business_rules.length}`);
    console.log(`   Chat commands: ${result3.spec.chat_commands.length}`);

    const validation = validateGeneratedSpec(result3.spec);
    console.log(`   Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);

    // Estimate cost
    const info = provider.getModelInfo();
    const inputCost = 3 * (info.cost_per_1k_input ?? 0); // ~3K prompt
    const outputCost = 6 * (info.cost_per_1k_output ?? 0); // ~6K output
    console.log(`   Est. cost: $${(inputCost + outputCost).toFixed(4)}`);
  } else {
    console.log(`❌ Failed (${elapsed3}s):`, result3.errors);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
