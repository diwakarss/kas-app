/**
 * Fresh Generator Service
 *
 * Generates new specs for unknown business types using LLM.
 * Uses pattern dictionaries to guide generation.
 */

import type { KASAppSpec } from '../../core/types/spec';
import type { LLMProvider } from '../types/providers';
import { LLMAdaptationLayer, createDefaultAdaptationLayer } from './llm-adaptation';
import { SpecValidator, getAllErrors } from './spec-validator';
import { BusinessIdentityService } from './business-identity';
import type { BusinessIdentity } from '../types/generation';
import { calculateCost, logGenerationMetrics, createMetrics, type CostBreakdown } from './cost-tracker';

/**
 * Result of fresh generation.
 */
export interface FreshGenerationResult {
  success: true;
  spec: KASAppSpec;
  /** Generation metadata */
  metadata: {
    latency_ms: number;
    tokens_used: {
      input: number;
      output: number;
    };
    /** Cost in USD for this generation */
    cost_usd: number;
    /** Full cost breakdown */
    cost_breakdown: CostBreakdown;
    provider: string;
    model: string;
  };
}

/**
 * Error result from fresh generation.
 */
export interface FreshGenerationError {
  success: false;
  errors: string[];
  error_type: 'provider' | 'validation' | 'parsing';
}

export type FreshGenerationOutcome = FreshGenerationResult | FreshGenerationError;

/**
 * Fresh Generator class.
 */
export class FreshGenerator {
  private adapter: LLMAdaptationLayer;

  constructor(provider: LLMProvider) {
    this.adapter = new LLMAdaptationLayer(provider);
  }

  /**
   * Generate a new spec for an unknown business type.
   *
   * @param businessType - The business type description
   * @param identity - Business identity (name, etc.)
   * @param features - Optional features to include
   * @returns Generation result with spec or errors
   */
  async generate(
    businessType: string,
    identity: BusinessIdentity,
    features?: string[]
  ): Promise<FreshGenerationOutcome> {
    // Validate identity first
    const identityValidation = BusinessIdentityService.validate(identity);
    if (!identityValidation.valid) {
      return {
        success: false,
        errors: identityValidation.errors,
        error_type: 'validation',
      };
    }

    try {
      // Generate spec via LLM
      const result = await this.adapter.generateSpec(
        businessType,
        identity.name,
        features
      );

      // Validate the generated spec
      const validation = SpecValidator.validate(result.spec);

      if (!validation.valid) {
        return {
          success: false,
          errors: getAllErrors(validation),
          error_type: 'validation',
        };
      }

      // Log injection warnings (but don't fail)
      if (validation.injection_warnings.length > 0) {
        console.warn('[FreshGenerator] Injection warnings:', validation.injection_warnings);
      }

      // Apply business identity
      const finalSpec = BusinessIdentityService.inject(result.spec, identity);

      // Get provider info for metadata and cost calculation
      const providerInfo = this.adapter.getProviderInfo();
      const costBreakdown = calculateCost(result.usage, providerInfo);

      // Log metrics for tracking
      logGenerationMetrics(
        createMetrics(
          businessType,
          result.usage,
          result.latency_ms,
          providerInfo,
          true
        )
      );

      return {
        success: true,
        spec: finalSpec,
        metadata: {
          latency_ms: result.latency_ms,
          tokens_used: {
            input: result.usage.input_tokens,
            output: result.usage.output_tokens,
          },
          cost_usd: costBreakdown.total_cost_usd,
          cost_breakdown: costBreakdown,
          provider: providerInfo.provider,
          model: providerInfo.model_id,
        },
      };
    } catch (error: any) {
      // Determine error type
      const errorType = error.message?.includes('parse')
        ? 'parsing'
        : error.message?.includes('LLM') || error.message?.includes('API')
        ? 'provider'
        : 'validation';

      // Log failed generation metrics (with zero cost if we don't have usage info)
      try {
        const providerInfo = this.adapter.getProviderInfo();
        logGenerationMetrics(
          createMetrics(
            businessType,
            { input_tokens: 0, output_tokens: 0 },
            0,
            providerInfo,
            false,
            error.message
          )
        );
      } catch {
        // Ignore logging errors
      }

      return {
        success: false,
        errors: [error.message || 'Unknown error during generation'],
        error_type: errorType,
      };
    }
  }

  /**
   * Check if generation is available (provider is configured).
   */
  async isAvailable(): Promise<boolean> {
    return this.adapter.isAvailable();
  }

  /**
   * Get provider information.
   */
  getProviderInfo() {
    return this.adapter.getProviderInfo();
  }
}

/**
 * Create a FreshGenerator with the default provider.
 */
export async function createFreshGenerator(): Promise<FreshGenerator> {
  const adapter = await createDefaultAdaptationLayer();
  // Extract the provider from the adapter (bit of a hack, but avoids changing the interface)
  // In practice, you'd pass the provider directly
  const { OpenAIProvider } = await import('../providers/openai-provider');
  const { QwenProvider } = await import('../providers/qwen-provider');

  // Check OpenAI first
  const openai = new OpenAIProvider();
  if (await openai.isAvailable()) {
    return new FreshGenerator(openai);
  }

  // Fall back to Qwen
  const qwen = new QwenProvider();
  if (await qwen.isAvailable()) {
    return new FreshGenerator(qwen);
  }

  throw new Error('No LLM provider available');
}
