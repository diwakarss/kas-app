/**
 * Release Envelope
 *
 * Handles spec publishing with version tracking and integrity verification.
 * Implements the "server is authoritative for version lineage" pattern.
 *
 * Release envelope structure:
 * {
 *   specId: string,
 *   version: number,
 *   specHash: string,
 *   producer: 'human' | 'agent',
 *   changeClass: 'S' | 'M' | 'I' | 'R',
 *   timestamp: string,
 *   signature: string
 * }
 */

import { createHash } from 'crypto';

export interface ReleaseEnvelope {
  specId: string;
  version: number;
  specHash: string;
  producer: 'human' | 'agent';
  changeClass: 'S' | 'M' | 'I' | 'R';
  changeDescription?: string;
  timestamp: string;
  previousVersion?: number;
  previousHash?: string;
}

export interface PublishRequest {
  appInstanceId: string;
  spec: Record<string, unknown>;
  producer: 'human' | 'agent';
  changeClass?: 'S' | 'M' | 'I' | 'R';
  changeDescription?: string;
}

export interface PublishResult {
  success: boolean;
  envelope?: ReleaseEnvelope;
  error?: string;
}

/**
 * Compute SHA-256 hash of a spec for integrity verification
 */
export function computeSpecHash(spec: Record<string, unknown>): string {
  const normalized = JSON.stringify(spec, Object.keys(spec).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Classify the change between two specs
 * Returns: S (safe), M (minor), I (intermediate), R (risky)
 */
export function classifyChange(
  oldSpec: Record<string, unknown> | null,
  newSpec: Record<string, unknown>
): 'S' | 'M' | 'I' | 'R' {
  if (!oldSpec) return 'S'; // First version is always safe

  const oldEntities = (oldSpec.entities as any[]) || [];
  const newEntities = (newSpec.entities as any[]) || [];

  const oldEntityNames = new Set(oldEntities.map((e: any) => e.name));
  const newEntityNames = new Set(newEntities.map((e: any) => e.name));

  // Check for removed entities (risky - data loss potential)
  for (const name of oldEntityNames) {
    if (!newEntityNames.has(name)) {
      return 'R'; // Risky: entity removed
    }
  }

  // Check for removed fields (intermediate - data loss potential)
  for (const oldEntity of oldEntities) {
    const newEntity = newEntities.find((e: any) => e.name === oldEntity.name);
    if (!newEntity) continue;

    const oldFieldNames = new Set((oldEntity.fields || []).map((f: any) => f.name));
    const newFieldNames = new Set((newEntity.fields || []).map((f: any) => f.name));

    for (const fieldName of oldFieldNames) {
      if (!newFieldNames.has(fieldName)) {
        return 'I'; // Intermediate: field removed
      }
    }
  }

  // Check for type changes (intermediate)
  for (const oldEntity of oldEntities) {
    const newEntity = newEntities.find((e: any) => e.name === oldEntity.name);
    if (!newEntity) continue;

    for (const oldField of oldEntity.fields || []) {
      const newField = (newEntity.fields || []).find((f: any) => f.name === oldField.name);
      if (newField && oldField.type !== newField.type) {
        return 'I'; // Intermediate: field type changed
      }
    }
  }

  // Check for new required fields (minor - may need defaults)
  for (const newEntity of newEntities) {
    const oldEntity = oldEntities.find((e: any) => e.name === newEntity.name);
    if (!oldEntity) {
      return 'M'; // Minor: new entity added
    }

    const oldFieldNames = new Set((oldEntity.fields || []).map((f: any) => f.name));

    for (const newField of newEntity.fields || []) {
      if (!oldFieldNames.has(newField.name) && newField.required) {
        return 'M'; // Minor: new required field
      }
    }
  }

  return 'S'; // Safe: additive changes only
}

/**
 * Validate spec structure before publishing
 */
export function validateSpec(spec: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!spec.meta || typeof spec.meta !== 'object') {
    errors.push('Missing or invalid meta section');
  } else {
    const meta = spec.meta as Record<string, unknown>;
    if (!meta.spec_id) errors.push('Missing meta.spec_id');
    if (!meta.name) errors.push('Missing meta.name');
    if (typeof meta.version !== 'number') errors.push('meta.version must be a number');
  }

  if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
    errors.push('entities must be a non-empty array');
  }

  if (!spec.anchor || typeof spec.anchor !== 'object') {
    errors.push('Missing or invalid anchor section');
  }

  return errors;
}

/**
 * Create a release envelope for a spec publish
 */
export function createReleaseEnvelope(
  appInstanceId: string,
  version: number,
  spec: Record<string, unknown>,
  producer: 'human' | 'agent',
  changeClass: 'S' | 'M' | 'I' | 'R',
  changeDescription?: string,
  previousVersion?: number,
  previousHash?: string
): ReleaseEnvelope {
  return {
    specId: appInstanceId,
    version,
    specHash: computeSpecHash(spec),
    producer,
    changeClass,
    changeDescription,
    timestamp: new Date().toISOString(),
    previousVersion,
    previousHash,
  };
}

/**
 * Verify release envelope integrity
 */
export function verifyEnvelope(
  envelope: ReleaseEnvelope,
  spec: Record<string, unknown>
): { valid: boolean; error?: string } {
  const computedHash = computeSpecHash(spec);

  if (computedHash !== envelope.specHash) {
    return {
      valid: false,
      error: `Hash mismatch: expected ${envelope.specHash}, got ${computedHash}`,
    };
  }

  return { valid: true };
}
