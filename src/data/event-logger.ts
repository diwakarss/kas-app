/**
 * Event Logger for KAS App JSON Renderer.
 *
 * Logs CRUD events to the _events table for timeline/story display.
 * Every mutation (create, update, archive) is recorded.
 */

import type { DatabaseAdapter } from './database-adapter';

export type EventType = 'created' | 'updated' | 'archived';

/**
 * Log an event to the _events table.
 */
export function logEvent(
  db: DatabaseAdapter,
  entityType: string,
  entityId: number,
  eventType: EventType,
  data?: Record<string, any>
): void {
  const dataJson = data ? JSON.stringify(data) : null;
  db.run(
    `INSERT INTO _events (entity_type, entity_id, event_type, data_json) VALUES (?, ?, ?, ?)`,
    [entityType, entityId, eventType, dataJson]
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
