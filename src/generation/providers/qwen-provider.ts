/**
 * Qwen Provider Implementation
 *
 * Uses Qwen 72B (or similar) for spec generation.
 * Primary production provider per implementation roadmap.
 *
 * Supports:
 * - Self-hosted Qwen via vLLM/TGI endpoint
 * - Alibaba Cloud Qwen API
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

const DEFAULT_QWEN_CONFIG: ProviderConfig = {
  endpoint: 'http://localhost:8000/v1/completions', // vLLM default
  default_model: 'Qwen/Qwen2.5-72B-Instruct',
  default_options: {
    max_tokens: 8192,
    temperature: 0.7,
    timeout_ms: 120000, // Qwen 72B can be slow
  },
};

/**
 * Request format for vLLM/OpenAI-compatible endpoints
 */
interface QwenRequest {
  model: string;
  prompt: string;
  max_tokens: number;
  temperature: number;
  stop?: string[];
}

/**
 * Response format from vLLM
 */
interface QwenResponse {
  id: string;
  choices: Array<{
    text: string;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class QwenProvider implements LLMProvider {
  private config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = resolveConfig(config, 'QWEN', DEFAULT_QWEN_CONFIG);
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...this.config.default_options, ...options };

    // Construct full prompt with system instruction if provided
    let fullPrompt = prompt;
    if (opts.system_prompt) {
      fullPrompt = `${opts.system_prompt}\n\n${prompt}`;
    }

    const requestBody: QwenRequest = {
      model: this.config.default_model,
      prompt: fullPrompt,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
      stop: ['```\n\n'], // Stop after JSON code block
    };

    const startTime = Date.now();

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout_ms);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add API key if configured
        if (this.config.api_key) {
          headers['Authorization'] = `Bearer ${this.config.api_key}`;
        }

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const retryable = response.status >= 500 || response.status === 429;
          throw new GenerationError(
            `Qwen API error: ${response.status} ${errorText}`,
            undefined,
            retryable
          );
        }

        const data: QwenResponse = await response.json();
        const latencyMs = Date.now() - startTime;

        if (!data.choices || data.choices.length === 0) {
          throw new GenerationError('Qwen returned no choices', undefined, true);
        }

        return {
          text: data.choices[0].text,
          usage: {
            input_tokens: data.usage?.prompt_tokens ?? 0,
            output_tokens: data.usage?.completion_tokens ?? 0,
          },
          latency_ms: latencyMs,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new GenerationError('Qwen request timed out', error, true);
        }

        if (error instanceof GenerationError) {
          throw error;
        }

        throw new GenerationError(`Qwen request failed: ${error.message}`, error, true);
      }
    });
  }

  getModelInfo(): ModelInfo {
    return {
      model_id: this.config.default_model,
      provider: 'qwen',
      max_context_tokens: 32768, // Qwen 2.5 context
      // Self-hosted: compute costs, not per-token
      cost_per_1k_input: 0,
      cost_per_1k_output: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if endpoint is reachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.config.endpoint.replace('/completions', '/models'), {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
