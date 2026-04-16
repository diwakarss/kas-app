/**
 * Spec Generator Service
 *
 * Main orchestrator for spec generation.
 * Routes requests through:
 * 1. Category Matcher (find matching template)
 * 2. Spec Library (load template) OR Fresh Generator (LLM)
 * 3. Business Identity (inject name/branding)
 * 4. Spec Validator (validate output)
 *
 * This is the primary entry point for spec generation.
 */

import type { KASAppSpec } from '../../core/types/spec';
import type { LLMProvider } from '../types/providers';
import type {
  GenerateRequest,
  GenerateResult,
  GenerateResponse,
  GenerateError,
} from '../types/generation';
import { SpecLibrary } from './spec-library';
import { CategoryMatcher } from './category-matcher';
import { BusinessIdentityService } from './business-identity';
import { SpecValidator, getAllErrors } from './spec-validator';
import { FreshGenerator } from './fresh-generator';

/**
 * Spec Generator configuration.
 */
export interface SpecGeneratorConfig {
  /** LLM provider for fresh generation (optional) */
  llmProvider?: LLMProvider;
  /** Minimum confidence for template matching (default: 0.7) */
  minMatchConfidence?: number;
  /** Allow fresh generation for unknown types (default: true) */
  allowFreshGeneration?: boolean;
}

/**
 * Spec Generator Service.
 */
export class SpecGenerator {
  private config: Required<SpecGeneratorConfig>;
  private freshGenerator: FreshGenerator | null = null;

  constructor(config: SpecGeneratorConfig = {}) {
    this.config = {
      llmProvider: config.llmProvider ?? (undefined as any),
      minMatchConfidence: config.minMatchConfidence ?? 0.7,
      allowFreshGeneration: config.allowFreshGeneration ?? true,
    };

    if (this.config.llmProvider) {
      this.freshGenerator = new FreshGenerator(this.config.llmProvider);
    }
  }

  /**
   * Generate a spec from a request.
   *
   * Flow:
   * 1. Validate request
   * 2. Try to match business type to template
   * 3. If match found: use template
   * 4. If no match and LLM available: fresh generate
   * 5. Apply business identity
   * 6. Validate output
   */
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    // 1. Validate request
    const validationErrors: string[] = [];

    if (!request.business_type || request.business_type.trim() === '') {
      validationErrors.push('business_type is required');
    }

    if (!request.business_name || request.business_name.trim() === '') {
      validationErrors.push('business_name is required');
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors,
        error_type: 'validation',
      };
    }

    const businessType = request.business_type.trim();
    const businessName = request.business_name.trim();

    // 2. Try to match to a template
    const matchResult = CategoryMatcher.match(businessType);
    console.log(
      `[SpecGenerator] Match result for '${businessType}':`,
      matchResult.matchType,
      matchResult.confidence
    );

    // 3. If good match found, use template
    if (
      matchResult.templateId &&
      matchResult.confidence >= this.config.minMatchConfidence
    ) {
      return this.generateFromTemplate(matchResult.templateId, businessName);
    }

    // 4. If no match, try fresh generation
    if (this.config.allowFreshGeneration && this.freshGenerator) {
      console.log('[SpecGenerator] No template match, attempting fresh generation');
      return this.generateFresh(businessType, businessName, request.features);
    }

    // 5. No template and no LLM - return error
    return {
      success: false,
      errors: [
        `No template found for business type '${businessType}'. ` +
          `Matched: ${matchResult.matchType} with confidence ${matchResult.confidence}. ` +
          'Fresh generation is not available.',
      ],
      error_type: 'generation',
    };
  }

  /**
   * Generate from a template.
   */
  private generateFromTemplate(
    templateId: string,
    businessName: string
  ): GenerateResult {
    // Load template
    const template = SpecLibrary.getTemplate(templateId);

    if (!template) {
      return {
        success: false,
        errors: [`Template '${templateId}' not found`],
        error_type: 'generation',
      };
    }

    try {
      // Apply business identity
      const spec = BusinessIdentityService.inject(template, { name: businessName });

      // Validate with catalog-backed schema checks
      const validation = SpecValidator.validateWithCatalog(spec);

      if (!validation.success) {
        return {
          success: false,
          errors: validation.errors,
          error_type: 'validation',
        };
      }

      const validatedSpec = validation.repaired!;

      if (validation.warnings.length > 0) {
        console.warn('[SpecGenerator] Spec warnings:', validation.warnings);
      }

      return {
        success: true,
        spec: validatedSpec,
        source: 'template',
        template_used: templateId,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message || 'Failed to generate from template'],
        error_type: 'generation',
      };
    }
  }

  /**
   * Generate fresh spec via LLM.
   */
  private async generateFresh(
    businessType: string,
    businessName: string,
    features?: string[]
  ): Promise<GenerateResult> {
    if (!this.freshGenerator) {
      return {
        success: false,
        errors: ['Fresh generation is not configured (no LLM provider)'],
        error_type: 'provider',
      };
    }

    const result = await this.freshGenerator.generate(
      businessType,
      { name: businessName },
      features
    );

    if (result.success === false) {
      return {
        success: false,
        errors: result.errors,
        error_type: result.error_type,
      };
    }

    return {
      success: true,
      spec: result.spec,
      source: 'generated',
    };
  }

  /**
   * List available templates.
   */
  listTemplates() {
    return SpecLibrary.listTemplates();
  }

  /**
   * Get a specific template.
   */
  getTemplate(templateId: string) {
    return SpecLibrary.getTemplate(templateId);
  }

  /**
   * Check if fresh generation is available.
   */
  async isFreshGenerationAvailable(): Promise<boolean> {
    if (!this.freshGenerator) return false;
    return this.freshGenerator.isAvailable();
  }

  /**
   * Set the LLM provider for fresh generation.
   */
  setLLMProvider(provider: LLMProvider): void {
    this.config.llmProvider = provider;
    this.freshGenerator = new FreshGenerator(provider);
  }
}

/**
 * Create a default SpecGenerator instance.
 * Tries to configure LLM provider automatically.
 */
export async function createSpecGenerator(): Promise<SpecGenerator> {
  const generator = new SpecGenerator();

  // Try to set up LLM provider
  try {
    const { OpenAIProvider } = await import('../providers/openai-provider');
    const openai = new OpenAIProvider();

    if (await openai.isAvailable()) {
      generator.setLLMProvider(openai);
      console.log('[SpecGenerator] Configured with OpenAI provider');
      return generator;
    }
  } catch {
    // OpenAI not available
  }

  try {
    const { QwenProvider } = await import('../providers/qwen-provider');
    const qwen = new QwenProvider();

    if (await qwen.isAvailable()) {
      generator.setLLMProvider(qwen);
      console.log('[SpecGenerator] Configured with Qwen provider');
      return generator;
    }
  } catch {
    // Qwen not available
  }

  console.log('[SpecGenerator] No LLM provider available, template-only mode');
  return generator;
}
