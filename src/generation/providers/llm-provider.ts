/**
 * LLM Provider Base Interface
 *
 * Abstract interface for LLM providers. Implementations must handle:
 * - API authentication
 * - Request/response formatting
 * - Error handling and retries
 */

import type {
  LLMProvider,
  GenerateOptions,
  GenerationResult,
  ModelInfo,
  ProviderConfig,
} from '../types/providers';
import { GenerationError } from '../types/providers';

export { LLMProvider, GenerateOptions, GenerationResult, ModelInfo, GenerationError };

/**
 * Default generation options.
 */
export const DEFAULT_OPTIONS: Required<GenerateOptions> = {
  max_tokens: 4096,
  temperature: 0.7,
  system_prompt: '',
  timeout_ms: 30000,
};

/**
 * Sleep utility for retry backoff.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff.
 *
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @returns Result of the function
 * @throws GenerationError after all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry non-retryable errors
      if (error instanceof GenerationError && !error.retryable) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[LLMProvider] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new GenerationError(
    `LLM generation failed after ${maxAttempts} attempts`,
    lastError,
    false
  );
}

/**
 * Parse provider config from environment or explicit config.
 */
export function resolveConfig(
  providedConfig: Partial<ProviderConfig>,
  envPrefix: string,
  defaults: ProviderConfig
): ProviderConfig {
  return {
    endpoint: providedConfig.endpoint || process.env[`${envPrefix}_ENDPOINT`] || defaults.endpoint,
    api_key: providedConfig.api_key || process.env[`${envPrefix}_API_KEY`] || defaults.api_key,
    default_model:
      providedConfig.default_model ||
      process.env[`${envPrefix}_MODEL`] ||
      defaults.default_model,
    default_options: {
      ...DEFAULT_OPTIONS,
      ...defaults.default_options,
      ...providedConfig.default_options,
    },
  };
}
