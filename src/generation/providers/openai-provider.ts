/**
 * OpenAI Provider Implementation
 *
 * Uses OpenAI API for spec generation. Primarily for testing and fallback.
 * Supports GPT-4 and GPT-3.5-turbo models.
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

const DEFAULT_OPENAI_CONFIG: ProviderConfig = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  default_model: 'gpt-4o',
  default_options: {
    max_tokens: 4096,
    temperature: 0.7,
    timeout_ms: 60000,
  },
};

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
}

interface OpenAIResponse {
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

export class OpenAIProvider implements LLMProvider {
  private config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = resolveConfig(config, 'OPENAI', DEFAULT_OPENAI_CONFIG);
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...this.config.default_options, ...options };

    const messages: OpenAIMessage[] = [];

    if (opts.system_prompt) {
      messages.push({ role: 'system', content: opts.system_prompt });
    }

    messages.push({ role: 'user', content: prompt });

    const requestBody: OpenAIRequest = {
      model: this.config.default_model,
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
            `OpenAI API error: ${response.status} ${errorText}`,
            undefined,
            retryable
          );
        }

        const data: OpenAIResponse = await response.json();
        const latencyMs = Date.now() - startTime;

        if (!data.choices || data.choices.length === 0) {
          throw new GenerationError('OpenAI returned no choices', undefined, true);
        }

        return {
          text: data.choices[0].message.content,
          usage: {
            input_tokens: data.usage.prompt_tokens,
            output_tokens: data.usage.completion_tokens,
          },
          latency_ms: latencyMs,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new GenerationError('OpenAI request timed out', error, true);
        }

        if (error instanceof GenerationError) {
          throw error;
        }

        throw new GenerationError(`OpenAI request failed: ${error.message}`, error, true);
      }
    });
  }

  getModelInfo(): ModelInfo {
    return {
      model_id: this.config.default_model,
      provider: 'openai',
      max_context_tokens: 128000, // GPT-4o context
      cost_per_1k_input: 0.005, // GPT-4o pricing
      cost_per_1k_output: 0.015,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.api_key;
  }
}
