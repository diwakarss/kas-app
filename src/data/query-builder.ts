/**
 * Query Builder for KAS App JSON Renderer.
 *
 * Builds parameterized SQL queries from structured filter/sort/limit options.
 * All output is parameterized — no string interpolation of user values.
 */

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export interface QueryFilter {
  field: string;
  op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface BuiltQuery {
  sql: string;
  params: any[];
}

// ──────────────────────────────────────────
// Table name helpers
// ──────────────────────────────────────────

/**
 * Convert entity name to snake_case table name.
 * Examples: "Student" → "student", "PaymentRecord" → "payment_record"
 */
export function toTableName(entityName: string): string {
  return entityName
    .replace(/([A-Z])/g, (match, p1, offset) =>
      offset > 0 ? `_${p1.toLowerCase()}` : p1.toLowerCase()
    );
}

/** Double-quote a table name to avoid SQLite reserved word collisions. */
export function q(name: string): string {
  return `"${name}"`;
}

// ──────────────────────────────────────────
// Query builders
// ──────────────────────────────────────────

/**
 * Build a SELECT * query with optional filters, ordering, and pagination.
 */
export function buildListQuery(
  tableName: string,
  options: QueryOptions = {}
): BuiltQuery {
  const clauses: string[] = [];
  const params: any[] = [];

  // Archived filter (default: exclude archived)
  if (!options.includeArchived) {
    clauses.push('archived = 0');
  }

  // User-provided filters
  if (options.filters) {
    for (const filter of options.filters) {
      clauses.push(`${filter.field} ${filter.op} ?`);
      params.push(filter.value);
    }
  }

  let sql = `SELECT * FROM ${q(tableName)}`;
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }

  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy} ${options.orderDir ?? 'ASC'}`;
  }

  if (options.limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  if (options.offset !== undefined) {
    sql += ` OFFSET ?`;
    params.push(options.offset);
  }

  return { sql, params };
}

/**
 * Build a SELECT by ID query.
 */
export function buildGetByIdQuery(tableName: string, id: number): BuiltQuery {
  return {
    sql: `SELECT * FROM ${q(tableName)} WHERE id = ?`,
    params: [id],
  };
}

/**
 * Build a SELECT by multiple IDs query (batch fetch).
 * Returns empty result if ids array is empty.
 */
export function buildGetByIdsQuery(tableName: string, ids: number[]): BuiltQuery {
  if (ids.length === 0) {
    return { sql: `SELECT * FROM ${q(tableName)} WHERE 1 = 0`, params: [] };
  }
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT * FROM ${q(tableName)} WHERE id IN (${placeholders})`,
    params: ids,
  };
}

/**
 * Build an INSERT statement from a data record.
 * Returns the SQL and the ordered parameter array.
 */
export function buildInsertQuery(
  tableName: string,
  data: Record<string, any>
): BuiltQuery {
  const fields = Object.keys(data);
  const placeholders = fields.map(() => '?');
  const params = fields.map((f) => data[f]);

  return {
    sql: `INSERT INTO ${q(tableName)} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
    params,
  };
}

/**
 * Build an UPDATE statement from a data record.
 */
export function buildUpdateQuery(
  tableName: string,
  id: number,
  data: Record<string, any>
): BuiltQuery {
  const fields = Object.keys(data);
  const setClauses = fields.map((f) => `${f} = ?`);
  const params = [...fields.map((f) => data[f]), id];

  return {
    sql: `UPDATE ${q(tableName)} SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    params,
  };
}

/**
 * Build a soft-delete (archive) statement.
 */
export function buildArchiveQuery(tableName: string, id: number): BuiltQuery {
  return {
    sql: `UPDATE ${q(tableName)} SET archived = 1, updated_at = datetime('now') WHERE id = ?`,
    params: [id],
  };
}

/**
 * Build an anchor query — entities for a target date with optional JOIN.
 *
 * @param entityTable - The anchor entity table (e.g., "class")
 * @param dateField - The date/datetime field to filter on
 * @param timeField - Optional field to order by time
 * @param joinTarget - Optional related entity to JOIN (e.g., "student")
 * @param joinFK - Foreign key field for the JOIN (e.g., "student_id")
 * @param dateOffset - SQLite date modifier (e.g., '-1 day' for yesterday). Defaults to today.
 */
export function buildAnchorQuery(
  entityTable: string,
  dateField: string,
  timeField?: string,
  joinTarget?: string,
  joinFK?: string,
  dateOffset?: string
): BuiltQuery {
  const params: any[] = [];

  const et = q(entityTable);
  let sql: string;
  if (joinTarget && joinFK) {
    const jt = q(joinTarget);
    sql = `SELECT ${et}.*, ${jt}.name as _related_name FROM ${et}`;
    sql += ` LEFT JOIN ${jt} ON ${et}.${joinFK} = ${jt}.id`;
  } else {
    sql = `SELECT * FROM ${et}`;
  }

  const dateFn = dateOffset ? `date('now', '${dateOffset}')` : `date('now')`;
  sql += ` WHERE ${et}.archived = 0 AND date(${et}.${dateField}) = ${dateFn}`;

  if (timeField) {
    sql += ` ORDER BY ${et}.${timeField} ASC`;
  }

  return { sql, params };
}

// ──────────────────────────────────────────
// Phase B query builders
// ──────────────────────────────────────────

export interface StoryEventSource {
  sourceTable: string;
  relationship: string;
  dateField: string;
  filter?: { field: string; value: string };
  eventType: string;
}

/**
 * Build a story timeline query for a single source entity.
 * Returns rows with _source_entity, _event_type, and _sort_date metadata.
 *
 * NOTE: We query each source separately (not UNION ALL) because different
 * source tables have different column counts, which SQLite UNION ALL rejects.
 * The caller merges and sorts results in JS.
 */
export function buildStorySourceQuery(
  src: StoryEventSource,
  entityId: number,
): BuiltQuery {
  const params: any[] = [];

  const st = q(src.sourceTable);
  let sql = `SELECT *, '${src.sourceTable}' AS _source_entity, '${src.eventType}' AS _event_type`;
  sql += `, ${src.dateField} AS _sort_date`;
  sql += ` FROM ${st}`;
  sql += ` WHERE archived = 0 AND ${src.relationship} = ?`;
  params.push(entityId);

  if (src.filter) {
    sql += ` AND ${src.filter.field} = ?`;
    params.push(src.filter.value);
  }

  sql += ` ORDER BY ${src.dateField} DESC`;

  return { sql, params };
}

/**
 * Build a calendar query — entities for a given month with optional JOIN.
 */
export function buildCalendarQuery(
  entityTable: string,
  dateField: string,
  year: number,
  month: number,
  joinTarget?: string,
  joinFK?: string
): BuiltQuery {
  const params: any[] = [];
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const et = q(entityTable);
  let sql: string;
  if (joinTarget && joinFK) {
    const jt = q(joinTarget);
    sql = `SELECT ${et}.*, ${jt}.name AS _related_name FROM ${et}`;
    sql += ` LEFT JOIN ${jt} ON ${et}.${joinFK} = ${jt}.id`;
  } else {
    sql = `SELECT * FROM ${et}`;
  }

  sql += ` WHERE ${et}.archived = 0`;
  sql += ` AND date(${et}.${dateField}) >= ? AND date(${et}.${dateField}) < ?`;
  params.push(firstDay, lastDay);

  sql += ` ORDER BY ${et}.${dateField} ASC`;

  return { sql, params };
}

/**
 * Build an FTS5 search query for a single entity table.
 */
export function buildSearchQuery(
  entityTable: string,
  searchTerm: string,
  limit: number = 20,
  joinTarget?: string,
  joinFK?: string
): BuiltQuery {
  const ftsTable = `${entityTable}_fts`;
  const params: any[] = [];
  const et = q(entityTable);
  const ft = q(ftsTable);

  const matchTerm = searchTerm.replace(/['"]/g, '') + '*';

  let sql: string;
  if (joinTarget && joinFK) {
    const jt = q(joinTarget);
    sql = `SELECT ${et}.*, ${jt}.name AS _related_name FROM ${ft}`;
    sql += ` JOIN ${et} ON ${ft}.rowid = ${et}.id`;
    sql += ` LEFT JOIN ${jt} ON ${et}.${joinFK} = ${jt}.id`;
  } else {
    sql = `SELECT ${et}.* FROM ${ft}`;
    sql += ` JOIN ${et} ON ${ft}.rowid = ${et}.id`;
  }

  sql += ` WHERE ${ft} MATCH ?`;
  params.push(matchTerm);

  sql += ` AND ${et}.archived = 0`;
  sql += ` LIMIT ?`;
  params.push(limit);

  return { sql, params };
}

/**
 * Build a LIKE-based search query as fallback when FTS5 is unavailable (web/sql.js).
 * Searches across all provided searchable fields with OR conditions.
 */
export function buildSearchQueryFallback(
  entityTable: string,
  searchTerm: string,
  searchableFields: string[],
  limit: number = 20,
  joinTarget?: string,
  joinFK?: string
): BuiltQuery {
  const params: any[] = [];
  const likeTerm = `%${searchTerm.replace(/['"]/g, '')}%`;
  const et = q(entityTable);

  let sql: string;
  if (joinTarget && joinFK) {
    const jt = q(joinTarget);
    sql = `SELECT ${et}.*, ${jt}.name AS _related_name FROM ${et}`;
    sql += ` LEFT JOIN ${jt} ON ${et}.${joinFK} = ${jt}.id`;
  } else {
    sql = `SELECT * FROM ${et}`;
  }

  const likeConditions = searchableFields.map((f) => {
    params.push(likeTerm);
    return `${et}.${f} LIKE ?`;
  });

  sql += ` WHERE ${et}.archived = 0`;
  if (likeConditions.length > 0) {
    sql += ` AND (${likeConditions.join(' OR ')})`;
  }

  sql += ` LIMIT ?`;
  params.push(limit);

  return { sql, params };
}
