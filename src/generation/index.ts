/**
 * Spec Generation Module
 *
 * Exports for spec generation from business type + name.
 */

// Types
export * from './types/generation';
export * from './types/patterns';
export * from './types/providers';

// Services
export { SpecLibrary } from './services/spec-library';
export { CategoryMatcher } from './services/category-matcher';
export { BusinessIdentityService, injectIdentity, validateIdentity } from './services/business-identity';
export { LLMAdaptationLayer, createDefaultAdaptationLayer, extractJSON, parseResponse } from './services/llm-adaptation';
export { FreshGenerator, createFreshGenerator } from './services/fresh-generator';
export { SpecValidator, validateGeneratedSpec, getAllErrors } from './services/spec-validator';
export { SpecGenerator, createSpecGenerator } from './services/spec-generator';

// Providers
export { QwenProvider } from './providers/qwen-provider';
export { OpenAIProvider } from './providers/openai-provider';
export { withRetry, sleep, resolveConfig, DEFAULT_OPTIONS } from './providers/llm-provider';
