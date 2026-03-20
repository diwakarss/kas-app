/**
 * LLM Provider Types
 *
 * Interface and types for LLM provider abstraction.
 */

/**
 * Options for LLM generation.
 */
export interface GenerateOptions {
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for sampling (0.0-1.0) */
  temperature?: number;
  /** System prompt (if supported) */
  system_prompt?: string;
  /** Timeout in milliseconds */
  timeout_ms?: number;
}

/**
 * Information about the model.
 */
export interface ModelInfo {
  /** Model identifier */
  model_id: string;
  /** Provider name */
  provider: string;
  /** Maximum context length */
  max_context_tokens: number;
  /** Cost per 1K input tokens (USD) */
  cost_per_1k_input?: number;
  /** Cost per 1K output tokens (USD) */
  cost_per_1k_output?: number;
}

/**
 * Result of a generation request.
 */
export interface GenerationResult {
  /** Generated text */
  text: string;
  /** Tokens used */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  /** Generation latency in ms */
  latency_ms: number;
}

/**
 * LLM Provider interface for abstraction.
 *
 * Implementations: QwenProvider, OpenAIProvider
 */
export interface LLMProvider {
  /**
   * Generate text from a prompt.
   * @throws GenerationError on failure
   */
  generate(prompt: string, options?: GenerateOptions): Promise<GenerationResult>;

  /**
   * Get information about the model.
   */
  getModelInfo(): ModelInfo;

  /**
   * Check if the provider is available/configured.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Error thrown by LLM providers.
 */
export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

/**
 * Provider configuration.
 */
export interface ProviderConfig {
  /** API endpoint */
  endpoint: string;
  /** API key (from environment or config) */
  api_key?: string;
  /** Default model to use */
  default_model: string;
  /** Default options */
  default_options?: GenerateOptions;
}
