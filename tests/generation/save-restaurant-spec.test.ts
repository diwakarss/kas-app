/**
 * Generate and save restaurant spec for UI testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecGenerator } from '../../src/generation/services/spec-generator';
import { DeepInfraProvider } from '../../src/generation/providers/deepinfra-provider';

const API_KEY = process.env.DEEPINFRA_API_KEY;

describe('Generate Restaurant Spec', () => {
  it('generates and saves restaurant spec', async () => {
    if (!API_KEY) {
      console.log('Skipping - no API key');
      return;
    }

    const provider = new DeepInfraProvider({ api_key: API_KEY });
    provider.setModelTier('capable');

    const generator = new SpecGenerator({
      llmProvider: provider,
      allowFreshGeneration: true,
    });

    console.log('Generating restaurant spec with Qwen3-Max...');
    const start = Date.now();

    const result = await generator.generate({
      business_type: 'restaurant',
      business_name: 'Spice Garden Indian Cuisine',
      features: ['table reservations', 'menu management', 'order tracking', 'delivery integration'],
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Generation took ${elapsed}s`);

    expect(result.success).toBe(true);

    if (result.success) {
      const specPath = path.join(__dirname, '../../assets/templates/restaurant.json');
      fs.writeFileSync(specPath, JSON.stringify(result.spec, null, 2));
      console.log('✅ Saved to assets/templates/restaurant.json');
      console.log('Entities:', result.spec.entities.map((e) => e.name).join(', '));
      console.log('Anchor:', result.spec.anchor.entity);
    }
  }, 180000);
});
