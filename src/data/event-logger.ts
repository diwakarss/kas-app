/**
 * Event Logger for KAS App JSON Renderer.
 *
 * Logs CRUD events to the _events table for timeline/story display.
 * Every mutation (create, update, archive) is recorded.
 *
 * Wave 2 Bridge Work: Extended event envelope with:
 * - change_class: S (Small) | M (Mutation) | I (Integration) | R (Risky)
 * - spec_version: Version of the spec at time of event
 * - policy_version: Version of policy for governance tracking
 * - diff_ref: Optional JSON Patch reference
 */

import type { DatabaseAdapter } from './database-adapter';
import type { KASAppSpec } from '../core/types/spec';

export type EventType = 'created' | 'updated' | 'archived';
export type ChangeClass = 'S' | 'M' | 'I' | 'R';

/**
 * Infer change_class from event type.
 * - created: Small change (S)
 * - updated: Mutation (M)
 * - archived: Mutation (M)
 */
function inferChangeClass(eventType: EventType): ChangeClass {
  switch (eventType) {
    case 'created':
      return 'S';
    case 'updated':
    case 'archived':
      return 'M';
    default:
      return 'S';
  }
}

/**
 * Options for logEvent to support extended envelope.
 */
export interface LogEventOptions {
  /** Override inferred change_class */
  changeClass?: ChangeClass;
  /** JSON Patch reference for diff tracking */
  diffRef?: string;
}

/**
 * Log an event to the _events table with extended envelope.
 *
 * @param db - Database adapter
 * @param spec - KAS App spec (for version tracking)
 * @param entityType - Entity type name
 * @param entityId - Entity ID
 * @param eventType - Type of event (created, updated, archived)
 * @param data - Optional event data payload
 * @param options - Optional extended envelope options
 */
export function logEvent(
  db: DatabaseAdapter,
  spec: KASAppSpec,
  entityType: string,
  entityId: number,
  eventType: EventType,
  data?: Record<string, any>,
  options?: LogEventOptions
): void {
  const dataJson = data ? JSON.stringify(data) : null;
  const changeClass = options?.changeClass ?? inferChangeClass(eventType);
  const specVersion = spec.meta.spec_version ?? spec.meta.version;
  const policyVersion = spec.meta.policy_version ?? 1;
  const diffRef = options?.diffRef ?? null;

  db.run(
    `INSERT INTO _events (entity_type, entity_id, event_type, data_json, change_class, spec_version, policy_version, diff_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, eventType, dataJson, changeClass, specVersion, policyVersion, diffRef]
  );
}

/**
 * Get recent events for a specific entity.
 */
export function getEntityEvents(
  db: DatabaseAdapter,
  entityType: string,
  entityId: number,
  limit: number = 20
): Record<string, any>[] {
  return db.getAll(
    `SELECT * FROM _events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?`,
    [entityType, entityId, limit]
  );
}
