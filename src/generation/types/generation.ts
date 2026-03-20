/**
 * Generation Types
 *
 * Request/response types for spec generation API.
 */

import type { KASAppSpec } from '../../core/types/spec';

/**
 * Request to generate a new spec.
 */
export interface GenerateRequest {
  /** Business type (e.g., "tutor", "bakery", "custom_artisan") */
  business_type: string;
  /** Business name for branding */
  business_name: string;
  /** Optional features to enable */
  features?: string[];
  /** Optional locale override */
  locale?: string;
}

/**
 * Response from spec generation.
 */
export interface GenerateResponse {
  success: true;
  spec: KASAppSpec;
  /** Source: "template" if matched, "generated" if LLM-created */
  source: 'template' | 'generated';
  /** Template name if source is "template" */
  template_used?: string;
}

/**
 * Error response from spec generation.
 */
export interface GenerateError {
  success: false;
  errors: string[];
  /** Error type for client handling */
  error_type: 'validation' | 'generation' | 'provider' | 'parsing';
}

export type GenerateResult = GenerateResponse | GenerateError;

/**
 * Template metadata in the registry.
 */
export interface TemplateMetadata {
  /** Template identifier (filename without .json) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the business type */
  description: string;
  /** Business type keywords for matching */
  keywords: string[];
  /** Category for grouping */
  category: 'service' | 'retail' | 'healthcare' | 'education' | 'other';
}

/**
 * Template registry (index.json structure).
 */
export interface TemplateRegistry {
  version: number;
  templates: TemplateMetadata[];
}

/**
 * Business identity for injection into specs.
 */
export interface BusinessIdentity {
  name: string;
  icon?: string;
  primary_color?: string;
  secondary_color?: string;
  locale?: string;
}
