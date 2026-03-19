/**
 * Computed Field Engine for KAS App JSON Renderer.
 *
 * Evaluates computed fields defined in spec.computed_fields for a given entity.
 * Supports:
 * - SQL aggregate types: count, sum, days_since, days_until, latest
 * - Formula type: arithmetic with field references and dependency resolution
 * - Cross-entity field references (e.g., student.hourly_fee from a Class entity)
 * - Topological sort for evaluation order (Kahn's algorithm)
 * - Circular dependency detection
 * - In-memory caching with CRUD-triggered invalidation
 */

import { KASAppSpec, ComputedField, Entity } from "../core/types/spec";
import { DatabaseAdapter } from "../data/database-adapter";
import { toTableName, q } from "../data/query-builder";
import { parse, evaluate, extractFieldRefs, FormulaContext } from "./formula-parser";

// Re-export for external use
export { FormulaContext };

// ===== Dependency Resolution =====

export class CircularDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" → ")}`);
    this.name = "CircularDependencyError";
  }
}

/**
 * Topological sort of computed fields using Kahn's algorithm.
 * Returns fields in evaluation order (dependencies first).
 */
export function topologicalSort(fields: ComputedField[]): ComputedField[] {
  const fieldMap = new Map<string, ComputedField>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>(); // field → fields that depend on it

  // Initialize
  for (const field of fields) {
    fieldMap.set(field.name, field);
    inDegree.set(field.name, 0);
    adjacency.set(field.name, []);
  }

  // Build dependency graph from formula fields
  for (const field of fields) {
    if (field.type === "formula" && field.formula) {
      const refs = extractFieldRefs(field.formula);
      for (const ref of refs.direct) {
        // Only count dependencies on OTHER computed fields
        if (fieldMap.has(ref)) {
          inDegree.set(field.name, (inDegree.get(field.name) ?? 0) + 1);
          adjacency.get(ref)!.push(field.name);
        }
        // Direct entity fields are not computed → no dependency
      }
      // Cross-entity refs (like student.hourly_fee) are resolved at eval time, not dependencies
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const result: ComputedField[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    result.push(fieldMap.get(name)!);

    for (const dependent of adjacency.get(name) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycles
  if (result.length !== fields.length) {
    const remaining = fields
      .filter((f) => !result.find((r) => r.name === f.name))
      .map((f) => f.name);
    throw new CircularDependencyError(remaining);
  }

  return result;
}

// ===== SQL Aggregate Evaluation =====

function buildFilterClause(
  filter: ComputedField["filter"]
): { clause: string; params: any[] } {
  if (!filter) return { clause: "", params: [] };

  switch (filter.condition) {
    case "equals":
      return { clause: ` AND ${filter.field} = ?`, params: [filter.value] };
    case "not_equals":
      return { clause: ` AND ${filter.field} != ?`, params: [filter.value] };
    case "after":
      return { clause: ` AND ${filter.field} > ?`, params: [filter.value] };
    case "before":
      return { clause: ` AND ${filter.field} < ?`, params: [filter.value] };
    default:
      return { clause: "", params: [] };
  }
}

function evaluateAggregate(
  field: ComputedField,
  entityId: number,
  db: DatabaseAdapter
): number | string | null {
  if (!field.source_entity || !field.relationship) return null;

  const sourceTable = q(toTableName(field.source_entity));
  const fk = field.relationship;
  const filter = buildFilterClause(field.filter);

  switch (field.type) {
    case "count": {
      const sql = `SELECT COUNT(*) as cnt FROM ${sourceTable} WHERE ${fk} = ? AND archived = 0${filter.clause}`;
      const row = db.getFirst<{ cnt: number }>(sql, [entityId, ...filter.params]);
      return row?.cnt ?? 0;
    }

    case "sum": {
      if (!field.source_field) return null;
      const sql = `SELECT COALESCE(SUM(${field.source_field}), 0) as total FROM ${sourceTable} WHERE ${fk} = ? AND archived = 0${filter.clause}`;
      const row = db.getFirst<{ total: number }>(sql, [entityId, ...filter.params]);
      return row?.total ?? 0;
    }

    case "days_since": {
      if (!field.date_field) return null;
      const sql = `SELECT MAX(${field.date_field}) as latest_date FROM ${sourceTable} WHERE ${fk} = ? AND archived = 0${filter.clause}`;
      const row = db.getFirst<{ latest_date: string | null }>(sql, [entityId, ...filter.params]);
      if (!row?.latest_date) return null;
      const latestDate = new Date(row.latest_date);
      const now = new Date();
      const diffMs = now.getTime() - latestDate.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    case "days_until": {
      if (!field.date_field) return null;
      const sql = `SELECT MIN(${field.date_field}) as next_date FROM ${sourceTable} WHERE ${fk} = ? AND archived = 0 AND ${field.date_field} > datetime('now')${filter.clause}`;
      const row = db.getFirst<{ next_date: string | null }>(sql, [entityId, ...filter.params]);
      if (!row?.next_date) return null;
      const nextDate = new Date(row.next_date);
      const now = new Date();
      const diffMs = nextDate.getTime() - now.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    case "latest": {
      if (!field.date_field) return null;
      const sql = `SELECT MAX(${field.date_field}) as latest_date FROM ${sourceTable} WHERE ${fk} = ? AND archived = 0${filter.clause}`;
      const row = db.getFirst<{ latest_date: string | null }>(sql, [entityId, ...filter.params]);
      return row?.latest_date ?? null;
    }

    default:
      return null;
  }
}

// ===== Cross-Entity Resolution =====

/**
 * Resolve a cross-entity field reference.
 * E.g., for a Class entity with student_id=5, resolving "student.hourly_fee"
 * follows the FK to Student table and returns hourly_fee.
 */
function resolveEntityField(
  entityName: string,
  fieldName: string,
  currentEntity: Entity,
  entityData: Record<string, any>,
  db: DatabaseAdapter,
  spec: KASAppSpec
): number | null {
  // Find the relationship that points to entityName
  const rel = currentEntity.relationships?.find(
    (r) =>
      r.target.toLowerCase() === entityName.toLowerCase() &&
      r.type === "belongs_to"
  );

  if (!rel) return null;

  // Get the FK value
  const fkValue = entityData[rel.foreign_key];
  if (fkValue == null) return null;

  // Look up the related entity
  const targetTable = q(toTableName(rel.target));
  const row = db.getFirst<Record<string, any>>(
    `SELECT ${fieldName} FROM ${targetTable} WHERE id = ?`,
    [fkValue]
  );

  if (!row) return null;
  const value = row[fieldName];
  return typeof value === "number" ? value : value != null ? Number(value) : null;
}

// ===== Cache =====

const cache = new Map<string, Record<string, number | string | null>>();

function cacheKey(entityType: string, entityId: number): string {
  return `${entityType}:${entityId}`;
}

/** Invalidate all cached computed fields for a given entity type. */
export function invalidateCache(entityType?: string): void {
  if (entityType) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${entityType}:`)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/** Invalidate cache for entities related to a source entity mutation. */
export function invalidateCacheForSource(sourceEntityType: string, spec: KASAppSpec): void {
  // Find all entity types that have computed fields referencing this source
  for (const [entityType, fields] of Object.entries(spec.computed_fields)) {
    const dependsOnSource = fields.some(
      (f) => f.source_entity === sourceEntityType
    );
    if (dependsOnSource) {
      invalidateCache(entityType);
    }
  }
}

// ===== Main API =====

/**
 * Evaluate all computed fields for a specific entity instance.
 *
 * @param entityType - Entity type name (e.g., "Student")
 * @param entityId - Entity ID
 * @param spec - The full KASAppSpec
 * @param db - Database adapter
 * @param entityData - Optional pre-loaded entity data. If not provided, will query from DB.
 * @returns Record mapping computed field names to their values
 */
export function evaluateComputedFields(
  entityType: string,
  entityId: number,
  spec: KASAppSpec,
  db: DatabaseAdapter,
  entityData?: Record<string, any>
): Record<string, number | string | null> {
  // Check cache
  const key = cacheKey(entityType, entityId);
  const cached = cache.get(key);
  if (cached) return cached;

  // Get entity definition
  const entity = spec.entities.find((e) => e.name === entityType);
  if (!entity) return {};

  // Get entity data if not provided
  if (!entityData) {
    const tableName = q(toTableName(entityType));
    entityData = db.getFirst(`SELECT * FROM ${tableName} WHERE id = ?`, [entityId]) ?? {};
  }

  // Get computed fields for this entity type
  const fields = spec.computed_fields[entityType];
  if (!fields || fields.length === 0) return {};

  // Topological sort for evaluation order
  const sortedFields = topologicalSort(fields);

  // Evaluate in order
  const result: Record<string, number | string | null> = {};

  for (const field of sortedFields) {
    if (field.type === "formula") {
      // Formula evaluation
      if (!field.formula) {
        result[field.name] = null;
        continue;
      }

      const ast = parse(field.formula);

      // Build context: merge entity data + already-computed values
      const allFields: Record<string, number | null> = {};
      // Add direct entity fields as numbers
      for (const [k, v] of Object.entries(entityData)) {
        allFields[k] = typeof v === "number" ? v : v != null ? Number(v) || null : null;
      }
      // Add already-computed values
      for (const [k, v] of Object.entries(result)) {
        allFields[k] = typeof v === "number" ? v : v != null ? Number(v) || null : null;
      }

      const context: FormulaContext = {
        fields: allFields,
        resolveEntityField: (eName, fName) =>
          resolveEntityField(eName, fName, entity, entityData!, db, spec),
      };

      result[field.name] = evaluate(ast, context);
    } else {
      // SQL aggregate evaluation
      result[field.name] = evaluateAggregate(field, entityId, db);
    }
  }

  // Cache the result
  cache.set(key, result);

  return result;
}
