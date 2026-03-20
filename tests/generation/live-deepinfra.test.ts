/**
 * Live DeepInfra/Qwen Generation Test
 *
 * Run with: DEEPINFRA_API_KEY=xxx npx jest tests/generation/live-deepinfra.test.ts
 *
 * This test is skipped by default unless API key is provided.
 */

import { SpecGenerator } from '../../src/generation/services/spec-generator';
import {
  DeepInfraProvider,
  DEEPINFRA_MODELS,
} from '../../src/generation/providers/deepinfra-provider';
import { validateGeneratedSpec } from '../../src/generation/services/spec-validator';

const API_KEY = process.env.DEEPINFRA_API_KEY;
const describeIfKey = API_KEY ? describe : describe.skip;

describeIfKey('Live DeepInfra Generation', () => {
  let provider: DeepInfraProvider;
  let generator: SpecGenerator;

  beforeAll(() => {
    provider = new DeepInfraProvider({ api_key: API_KEY });
    generator = new SpecGenerator({
      llmProvider: provider,
      allowFreshGeneration: true,
    });

    console.log('Models:');
    console.log(`  Fast:    ${DEEPINFRA_MODELS.FAST}`);
    console.log(`  Capable: ${DEEPINFRA_MODELS.CAPABLE}`);
  });

  it('template generation works (no LLM)', async () => {
    const result = await generator.generate({
      business_type: 'tutor',
      business_name: "Ravi's Piano Academy",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.source).toBe('template');
      expect(result.template_used).toBe('tutor');
      console.log('✅ Template: tutor');
      console.log(`   Entities: ${result.spec.entities.map((e) => e.name).join(', ')}`);
    }
  });

  it(
    'fresh generation with FAST model (florist)',
    async () => {
      provider.setModelTier('fast');
      console.log(`Using: ${provider.getCurrentModel()}`);

      const start = Date.now();
      const result = await generator.generate({
        business_type: 'florist',
        business_name: "Rosa's Flower Shop",
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (result.success) {
        expect(result.source).toBe('generated');
        console.log(`✅ Generated in ${elapsed}s`);
        console.log(`   Entities: ${result.spec.entities.map((e) => e.name).join(', ')}`);
        console.log(`   Anchor: ${result.spec.anchor.entity}`);

        const validation = validateGeneratedSpec(result.spec);
        console.log(`   Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
        expect(validation.valid).toBe(true);
      } else {
        console.log(`❌ Failed in ${elapsed}s`);
        console.log(`   Error type: ${result.error_type}`);
        console.log(`   Errors:`, result.errors);
        expect(result.success).toBe(true); // Will fail with context
      }
    },
    120000
  ); // 2 minute timeout

  it(
    'fresh generation with CAPABLE model (restaurant)',
    async () => {
      provider.setModelTier('capable');
      console.log(`Using: ${provider.getCurrentModel()}`);

      const start = Date.now();
      const result = await generator.generate({
        business_type: 'restaurant',
        business_name: 'Spice Garden Indian Cuisine',
        features: ['table reservations', 'menu management', 'order tracking'],
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.source).toBe('generated');
        console.log(`✅ Generated in ${elapsed}s`);
        console.log(`   Entities: ${result.spec.entities.map((e) => e.name).join(', ')}`);
        console.log(`   Anchor: ${result.spec.anchor.entity}`);
        console.log(`   Business rules: ${result.spec.business_rules.length}`);

        const validation = validateGeneratedSpec(result.spec);
        console.log(`   Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
        if (!validation.valid) {
          console.log('   Errors:', [
            ...validation.structural_errors.slice(0, 3),
            ...validation.semantic_errors.slice(0, 3),
          ]);
        }
      }
    },
    120000
  ); // 2 minute timeout
});
