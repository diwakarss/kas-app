/**
 * Business Identity Service
 *
 * Injects business identity (name, icon, colors) into a spec.
 * Validates that required identity fields are present.
 */

import type { KASAppSpec } from '../../core/types/spec';
import type { BusinessIdentity } from '../types/generation';

/**
 * Validation result for business identity.
 */
export interface IdentityValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a business identity.
 */
export function validateIdentity(identity: BusinessIdentity): IdentityValidationResult {
  const errors: string[] = [];

  // Business name is required
  if (!identity.name || identity.name.trim() === '') {
    errors.push('business_name is required and cannot be empty');
  }

  // Name length check
  if (identity.name && identity.name.length > 100) {
    errors.push('business_name cannot exceed 100 characters');
  }

  // Icon validation (if provided)
  if (identity.icon !== undefined && identity.icon !== null) {
    if (typeof identity.icon !== 'string') {
      errors.push('icon must be a string');
    }
  }

  // Color validation (if provided)
  if (identity.primary_color !== undefined && identity.primary_color !== null) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(identity.primary_color)) {
      errors.push('primary_color must be a valid hex color (e.g., #FF5733)');
    }
  }

  if (identity.secondary_color !== undefined && identity.secondary_color !== null) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(identity.secondary_color)) {
      errors.push('secondary_color must be a valid hex color (e.g., #FF5733)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Inject business identity into a spec.
 * Returns a new spec with identity applied (does not mutate original).
 *
 * @param spec - The base spec to inject identity into
 * @param identity - The business identity to inject
 * @returns New spec with identity applied
 * @throws Error if identity validation fails
 */
export function injectIdentity(spec: KASAppSpec, identity: BusinessIdentity): KASAppSpec {
  // Validate identity first
  const validation = validateIdentity(identity);
  if (!validation.valid) {
    throw new Error(`Invalid business identity: ${validation.errors.join(', ')}`);
  }

  // Deep clone the spec to avoid mutation
  const newSpec: KASAppSpec = JSON.parse(JSON.stringify(spec));

  // Update meta with business name
  newSpec.meta.name = identity.name.trim();

  // Update spec_id to include business name slug
  const nameSlug = identity.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  newSpec.meta.spec_id = `${newSpec.meta.business_type}-${nameSlug}-${Date.now().toString(36)}`;

  // Update created_date to now
  newSpec.meta.created_date = new Date().toISOString();

  // Update version history
  newSpec.meta.version_history = [
    {
      version: newSpec.meta.version,
      date: new Date().toISOString(),
      source: 'generated',
      changes: `Generated for ${identity.name}`,
    },
  ];

  // Clear customizations (fresh spec)
  newSpec.meta.customizations = [];

  // Update greeting template if it references business name
  if (newSpec.anchor.greeting_template) {
    newSpec.anchor.greeting_template = newSpec.anchor.greeting_template.replace(
      /{business_name}/g,
      identity.name
    );
  }

  // TODO: Apply icon and colors when spec schema supports them
  // Currently, these are stored but not applied to the spec structure
  // Future: Add color_scheme to meta, update entity icons, etc.

  return newSpec;
}

/**
 * Extract business identity from an existing spec.
 */
export function extractIdentity(spec: KASAppSpec): BusinessIdentity {
  return {
    name: spec.meta.name,
    // TODO: Extract icon and colors when schema supports them
    icon: undefined,
    primary_color: undefined,
    secondary_color: undefined,
    locale: undefined,
  };
}

/**
 * Business Identity Service (namespace export)
 */
export const BusinessIdentityService = {
  validate: validateIdentity,
  inject: injectIdentity,
  extract: extractIdentity,
};
