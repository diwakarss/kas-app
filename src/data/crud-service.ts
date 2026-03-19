/**
 * CRUD Service for KAS App JSON Renderer.
 *
 * Generic CRUD operations for any spec-defined entity.
 * Every mutation logs to _events and triggers FTS5 sync via SQL triggers.
 *
 * Design:
 * - Parameterized SQL only (via query-builder)
 * - Soft-delete via archived column
 * - Event logging on every mutation
 * - Cache invalidation for computed fields
 */

import type { DatabaseAdapter } from './database-adapter';
import type { KASAppSpec } from '../core/types/spec';
import { Platform } from 'react-native';
import {
  toTableName,
  buildListQuery,
  buildGetByIdQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildArchiveQuery,
  buildAnchorQuery,
  buildStorySourceQuery,
  buildCalendarQuery,
  buildSearchQuery,
  buildSearchQueryFallback,
  QueryOptions,
  StoryEventSource,
} from './query-builder';
import { logEvent } from './event-logger';
import { invalidateCache, invalidateCacheForSource } from '../engines/computed-field-engine';

// ──────────────────────────────────────────
// CRUD Service
// ──────────────────────────────────────────

export class CrudService {
  constructor(
    private db: DatabaseAdapter,
    private spec: KASAppSpec
  ) {}

  /**
   * Create a new entity record.
   * @returns The new record's ID.
   */
  create(entityType: string, data: Record<string, any>): number {
    const tableName = toTableName(entityType);
    const query = buildInsertQuery(tableName, data);
    const result = this.db.run(query.sql, query.params);

    logEvent(this.db, entityType, result.lastInsertRowId, 'created', data);
    invalidateCacheForSource(entityType, this.spec);

    return result.lastInsertRowId;
  }

  /**
   * Read a single entity by ID.
   */
  read(entityType: string, id: number): Record<string, any> | null {
    const tableName = toTableName(entityType);
    const query = buildGetByIdQuery(tableName, id);
    return this.db.getFirst(query.sql, query.params);
  }

  /**
   * List entities with optional filtering, ordering, and pagination.
   */
  list(entityType: string, options: QueryOptions = {}): Record<string, any>[] {
    const tableName = toTableName(entityType);
    const query = buildListQuery(tableName, options);
    return this.db.getAll(query.sql, query.params);
  }

  /**
   * Update an existing entity.
   * @returns Number of rows affected (0 or 1).
   */
  update(entityType: string, id: number, data: Record<string, any>): number {
    const tableName = toTableName(entityType);
    const query = buildUpdateQuery(tableName, id, data);
    const result = this.db.run(query.sql, query.params);

    if (result.changes > 0) {
      logEvent(this.db, entityType, id, 'updated', data);
      invalidateCache(entityType);
      invalidateCacheForSource(entityType, this.spec);
    }

    return result.changes;
  }

  /**
   * Soft-delete (archive) an entity.
   * @returns Number of rows affected (0 or 1).
   */
  archive(entityType: string, id: number): number {
    const tableName = toTableName(entityType);
    const query = buildArchiveQuery(tableName, id);
    const result = this.db.run(query.sql, query.params);

    if (result.changes > 0) {
      logEvent(this.db, entityType, id, 'archived');
      invalidateCache(entityType);
      invalidateCacheForSource(entityType, this.spec);
    }

    return result.changes;
  }

  /**
   * Query entities for the anchor screen (filtered by date with optional offset).
   */
  anchorQuery(
    dateField: string,
    timeField?: string,
    joinTarget?: string,
    joinFK?: string,
    dateOffset?: string
  ): Record<string, any>[] {
    const entityTable = toTableName(this.spec.anchor.entity);
    const query = buildAnchorQuery(entityTable, dateField, timeField, joinTarget, joinFK, dateOffset);
    return this.db.getAll(query.sql, query.params);
  }

  // ────────────────────────────────────────
  // Phase B queries
  // ────────────────────────────────────────

  /**
   * Query story timeline events from multiple source entities.
   * Queries each source independently, merges + sorts in JS,
   * then applies pagination. This avoids UNION ALL column mismatch
   * since different source tables have different schemas.
   */
  storyEvents(
    sources: StoryEventSource[],
    entityId: number,
    limit: number = 50,
    offset: number = 0
  ): Record<string, any>[] {
    if (sources.length === 0) return [];

    const allRows: Record<string, any>[] = [];
    for (const src of sources) {
      const query = buildStorySourceQuery(src, entityId);
      const rows = this.db.getAll(query.sql, query.params);
      allRows.push(...rows);
    }

    // Sort by _sort_date descending
    allRows.sort((a, b) => {
      const da = a._sort_date || '';
      const db = b._sort_date || '';
      return db < da ? -1 : db > da ? 1 : 0;
    });

    // Apply pagination
    return allRows.slice(offset, offset + limit);
  }

  /**
   * Query calendar events for a given month.
   */
  calendarEvents(
    entityType: string,
    dateField: string,
    year: number,
    month: number,
    joinTarget?: string,
    joinFK?: string
  ): Record<string, any>[] {
    const entityTable = toTableName(entityType);
    const query = buildCalendarQuery(entityTable, dateField, year, month, joinTarget, joinFK);
    return this.db.getAll(query.sql, query.params);
  }

  /**
   * Full-text search across a single entity type.
   * Uses FTS5 on native, falls back to LIKE on web (sql.js lacks FTS5).
   */
  search(
    entityType: string,
    term: string,
    limit: number = 20,
    joinTarget?: string,
    joinFK?: string
  ): Record<string, any>[] {
    if (!term.trim()) return [];
    const entityTable = toTableName(entityType);

    // Web: FTS5 unavailable in sql.js — use LIKE fallback
    if (Platform.OS === 'web') {
      const entity = this.spec.entities.find((e) => e.name === entityType);
      const searchableFields = entity
        ? entity.fields.filter((f) => f.searchable).map((f) => f.name)
        : [];
      if (searchableFields.length === 0) return [];
      const query = buildSearchQueryFallback(entityTable, term, searchableFields, limit, joinTarget, joinFK);
      return this.db.getAll(query.sql, query.params);
    }

    // Native: use FTS5
    const query = buildSearchQuery(entityTable, term, limit, joinTarget, joinFK);
    try {
      return this.db.getAll(query.sql, query.params);
    } catch {
      // FTS5 match can throw on malformed queries — return empty
      return [];
    }
  }
}
