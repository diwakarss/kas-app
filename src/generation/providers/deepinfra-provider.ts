/**
 * DeepInfra Provider Implementation
 *
 * Uses DeepInfra's OpenAI-compatible API for Qwen access.
 * Supports model routing based on task complexity.
 *
 * Models:
 * - Qwen3-30B-A3B ($0.08/$0.28) - fast, for simple scaffolding
 * - Qwen3-235B-A22B-Instruct-2507 ($0.071/$0.10) - capable, for complex generation
 */

import type {
  LLMProvider,
  GenerateOptions,
  GenerationResult,
  ModelInfo,
  ProviderConfig,
} from '../types/providers';
import { GenerationError } from '../types/providers';
import { DEFAULT_OPTIONS, resolveConfig, withRetry } from './llm-provider';

/**
 * DeepInfra model identifiers
 */
export const DEEPINFRA_MODELS = {
  /** Fast model for simple scaffolding - $0.08/$0.28 per 1M tokens */
  FAST: 'Qwen/Qwen3-30B-A3B',
  /** Capable model for complex generation */
  CAPABLE: 'Qwen/Qwen3-Max',
  /** Alternative: 235B instruct (slower but cheaper) */
  CAPABLE_235B: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
} as const;

const DEFAULT_DEEPINFRA_CONFIG: ProviderConfig = {
  endpoint: 'https://api.deepinfra.com/v1/openai/chat/completions',
  default_model: DEEPINFRA_MODELS.FAST,
  default_options: {
    max_tokens: 8192,
    temperature: 0.7,
    timeout_ms: 120000,
  },
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}

interface ChatResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type ModelTier = 'fast' | 'capable';

export class DeepInfraProvider implements LLMProvider {
  private config: ProviderConfig;
  private currentModel: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = resolveConfig(config, 'DEEPINFRA', DEFAULT_DEEPINFRA_CONFIG);
    this.currentModel = this.config.default_model;
  }

  /**
   * Set the model tier for subsequent requests.
   * - 'fast': Qwen3-30B for simple scaffolding
   * - 'capable': Qwen3-235B for complex generation
   */
  setModelTier(tier: ModelTier): void {
    this.currentModel = tier === 'capable' ? DEEPINFRA_MODELS.CAPABLE : DEEPINFRA_MODELS.FAST;
  }

  /**
   * Get the current model being used.
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...this.config.default_options, ...options };

    const messages: ChatMessage[] = [];

    if (opts.system_prompt) {
      messages.push({ role: 'system', content: opts.system_prompt });
    }

    messages.push({ role: 'user', content: prompt });

    const requestBody: ChatRequest = {
      model: this.currentModel,
      messages,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    };

    const startTime = Date.now();

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout_ms);

      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.api_key}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const retryable = response.status >= 500 || response.status === 429;
          throw new GenerationError(
            `DeepInfra API error: ${response.status} ${errorText}`,
            undefined,
            retryable
          );
        }

        const data: ChatResponse = await response.json();
        const latencyMs = Date.now() - startTime;

        if (!data.choices || data.choices.length === 0) {
          throw new GenerationError('DeepInfra returned no choices', undefined, true);
        }

        return {
          text: data.choices[0].message.content,
          usage: {
            input_tokens: data.usage?.prompt_tokens ?? 0,
            output_tokens: data.usage?.completion_tokens ?? 0,
          },
          latency_ms: latencyMs,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new GenerationError('DeepInfra request timed out', error, true);
        }

        if (error instanceof GenerationError) {
          throw error;
        }

        throw new GenerationError(`DeepInfra request failed: ${error.message}`, error, true);
      }
    });
  }

  getModelInfo(): ModelInfo {
    const isCapable = this.currentModel === DEEPINFRA_MODELS.CAPABLE;

    return {
      model_id: this.currentModel,
      provider: 'deepinfra',
      max_context_tokens: isCapable ? 131072 : 32768,
      // Prices per 1K tokens (converted from per 1M)
      cost_per_1k_input: isCapable ? 0.000071 : 0.00008,
      cost_per_1k_output: isCapable ? 0.0001 : 0.00028,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.api_key;
  }
}
