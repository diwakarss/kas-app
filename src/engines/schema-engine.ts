/**
 * Schema Engine for KAS App JSON Renderer.
 *
 * Reads a KASAppSpec and generates an ordered array of SQL DDL statements
 * that create the complete SQLite database schema when executed sequentially.
 *
 * Design decisions:
 * - All DDL uses IF NOT EXISTS for idempotent re-runs
 * - FK fields are corrected to INTEGER regardless of spec field type
 * - Tables are ordered by dependency (no-FK tables first)
 * - FTS5 virtual tables + sync triggers for searchable fields
 * - System columns (id, created_at, updated_at, archived) on every entity
 * - Single _events table for cross-entity event log
 */

import type { KASAppSpec, Entity, FieldType } from '../core/types/spec';

/** Double-quote a table name to avoid SQLite reserved word collisions. */
function q(name: string): string {
  return `"${name}"`;
}

// ───────────────────────────────────────────────
// Type mapping
// ───────────────────────────────────────────────

const FIELD_TYPE_MAP: Record<FieldType, string> = {
  text: 'TEXT',
  note: 'TEXT',
  image: 'TEXT',
  phone: 'TEXT',
  email: 'TEXT',
  choice: 'TEXT',
  number: 'INTEGER',
  currency: 'REAL',
  date: 'TEXT',
  datetime: 'TEXT',
  time: 'TEXT',
  toggle: 'INTEGER',
  duration: 'INTEGER',
};

/**
 * Map a spec FieldType to a SQLite column type.
 */
export function mapFieldType(type: FieldType): string {
  return FIELD_TYPE_MAP[type] ?? 'TEXT';
}

// ───────────────────────────────────────────────
// Dependency-ordered entity sorting
// ───────────────────────────────────────────────

/**
 * Topological sort: entities with no belongs_to first,
 * then entities that depend on those, etc.
 */
function sortEntitiesByDependency(entities: Entity[]): Entity[] {
  const nameToEntity = new Map<string, Entity>();
  for (const e of entities) {
    nameToEntity.set(e.name, e);
  }

  // Build adjacency: entity -> set of entities it depends on (belongs_to targets)
  const deps = new Map<string, Set<string>>();
  for (const e of entities) {
    const d = new Set<string>();
    for (const rel of e.relationships) {
      if (rel.type === 'belongs_to') {
        d.add(rel.target);
      }
    }
    deps.set(e.name, d);
  }

  const sorted: Entity[] = [];
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);
    const entityDeps = deps.get(name);
    if (entityDeps) {
      for (const dep of entityDeps) {
        visit(dep);
      }
    }
    const entity = nameToEntity.get(name);
    if (entity) {
      sorted.push(entity);
    }
  }

  for (const e of entities) {
    visit(e.name);
  }

  return sorted;
}

// ───────────────────────────────────────────────
// FK field detection
// ───────────────────────────────────────────────

/**
 * Collect the set of field names that are foreign keys (from belongs_to relationships).
 */
function getForeignKeyFields(entity: Entity): Map<string, string> {
  const fkMap = new Map<string, string>(); // field_name -> target_entity
  for (const rel of entity.relationships) {
    if (rel.type === 'belongs_to') {
      fkMap.set(rel.foreign_key, rel.target.toLowerCase());
    }
  }
  return fkMap;
}

// ───────────────────────────────────────────────
// DDL Generation
// ───────────────────────────────────────────────

/**
 * Generate all DDL statements for the given spec.
 * Returns an ordered array of SQL strings.
 */
export function generateDDL(spec: KASAppSpec): string[] {
  const statements: string[] = [];
  const sorted = sortEntitiesByDependency(spec.entities);

  for (const entity of sorted) {
    const tableName = entity.name.toLowerCase();
    const fkFields = getForeignKeyFields(entity);

    // ── CREATE TABLE ──
    const columns: string[] = [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
    ];

    for (const field of entity.fields) {
      if (fkFields.has(field.name)) {
        // FK field: override type to INTEGER with REFERENCES
        const target = fkFields.get(field.name)!;
        columns.push(`${field.name} INTEGER REFERENCES ${q(target)}(id)`);
      } else {
        columns.push(`${field.name} ${mapFieldType(field.type)}`);
      }
    }

    columns.push("created_at TEXT DEFAULT (datetime('now'))");
    columns.push("updated_at TEXT DEFAULT (datetime('now'))");
    columns.push('archived INTEGER DEFAULT 0');

    statements.push(
      `CREATE TABLE IF NOT EXISTS ${q(tableName)} (\n  ${columns.join(',\n  ')}\n);`
    );

    // ── CREATE INDEX on FK columns ──
    for (const [fkField] of fkFields) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_${fkField} ON ${q(tableName)}(${fkField});`
      );
    }

    // ── FTS5 virtual table (if searchable fields exist) ──
    const searchableFields = entity.fields
      .filter((f) => f.searchable)
      .map((f) => f.name);

    if (searchableFields.length > 0) {
      const fieldList = searchableFields.join(', ');

      const ftsName = `${tableName}_fts`;
      statements.push(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${q(ftsName)} USING fts5(\n  ${fieldList},\n  content=${q(tableName)},\n  content_rowid=id\n);`
      );

      // ── FTS5 sync triggers ──
      const newFields = searchableFields.map((f) => `new.${f}`).join(', ');
      const oldFields = searchableFields.map((f) => `old.${f}`).join(', ');

      // AFTER INSERT
      statements.push(
        `CREATE TRIGGER IF NOT EXISTS ${tableName}_ai AFTER INSERT ON ${q(tableName)} BEGIN\n` +
        `  INSERT INTO ${q(ftsName)}(rowid, ${fieldList}) VALUES (new.id, ${newFields});\n` +
        `END;`
      );

      // AFTER UPDATE
      statements.push(
        `CREATE TRIGGER IF NOT EXISTS ${tableName}_au AFTER UPDATE ON ${q(tableName)} BEGIN\n` +
        `  INSERT INTO ${q(ftsName)}(${q(ftsName)}, rowid, ${fieldList}) VALUES('delete', old.id, ${oldFields});\n` +
        `  INSERT INTO ${q(ftsName)}(rowid, ${fieldList}) VALUES (new.id, ${newFields});\n` +
        `END;`
      );

      // AFTER DELETE
      statements.push(
        `CREATE TRIGGER IF NOT EXISTS ${tableName}_ad AFTER DELETE ON ${q(tableName)} BEGIN\n` +
        `  INSERT INTO ${q(ftsName)}(${q(ftsName)}, rowid, ${fieldList}) VALUES('delete', old.id, ${oldFields});\n` +
        `END;`
      );
    }
  }

  // ── _events table (once, after all entity tables) ──
  statements.push(
    `CREATE TABLE IF NOT EXISTS _events (\n` +
    `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n` +
    `  entity_type TEXT NOT NULL,\n` +
    `  entity_id INTEGER NOT NULL,\n` +
    `  event_type TEXT NOT NULL,\n` +
    `  data_json TEXT,\n` +
    `  created_at TEXT DEFAULT (datetime('now'))\n` +
    `);`
  );

  statements.push(
    `CREATE INDEX IF NOT EXISTS idx_events_entity ON _events(entity_type, entity_id);`
  );

  statements.push(
    `CREATE INDEX IF NOT EXISTS idx_events_created ON _events(created_at);`
  );

  return statements;
}

// ───────────────────────────────────────────────
// Schema Migration (Phase C)
// ───────────────────────────────────────────────

/**
 * Compare the spec against the existing database schema
 * and generate ALTER TABLE ADD COLUMN statements for new fields.
 *
 * Constraints:
 * - Additive-only: only ADD COLUMN, never DROP or RENAME
 * - New columns get NULL default (SQLite behavior)
 * - FTS5 tables are rebuilt if new searchable fields are added
 */
export function generateMigration(
  adapter: import('../data/database-adapter').DatabaseAdapter,
  spec: KASAppSpec
): string[] {
  const statements: string[] = [];

  for (const entity of spec.entities) {
    const tableName = entity.name.toLowerCase();
    const fkFields = getForeignKeyFields(entity);

    // Get existing columns via PRAGMA
    let existingColumns: { name: string }[];
    try {
      existingColumns = adapter.getAll<{ name: string }>(`PRAGMA table_info(${q(tableName)})`);
    } catch {
      // Table doesn't exist yet — skip migration (generateDDL will create it)
      continue;
    }

    if (existingColumns.length === 0) continue;

    const existingNames = new Set(existingColumns.map((c) => c.name));

    for (const field of entity.fields) {
      if (!existingNames.has(field.name)) {
        const sqlType = fkFields.has(field.name)
          ? `INTEGER REFERENCES ${q(fkFields.get(field.name)!)}(id)`
          : mapFieldType(field.type);
        statements.push(
          `ALTER TABLE ${q(tableName)} ADD COLUMN ${field.name} ${sqlType};`
        );
      }
    }

    // Check if FTS5 table needs rebuild (new searchable fields)
    const searchableFields = entity.fields
      .filter((f) => f.searchable)
      .map((f) => f.name);

    if (searchableFields.length > 0) {
      const newSearchable = searchableFields.filter((f) => !existingNames.has(f));
      if (newSearchable.length > 0) {
        const ftsTable = `${tableName}_fts`;
        // Drop and recreate FTS5 with all searchable fields
        statements.push(`DROP TABLE IF EXISTS ${q(ftsTable)};`);
        const fieldList = searchableFields.join(', ');
        statements.push(
          `CREATE VIRTUAL TABLE IF NOT EXISTS ${q(ftsTable)} USING fts5(\n  ${fieldList},\n  content=${q(tableName)},\n  content_rowid=id\n);`
        );

        // Rebuild FTS5 sync triggers
        const newFields = searchableFields.map((f) => `new.${f}`).join(', ');
        const oldFields = searchableFields.map((f) => `old.${f}`).join(', ');

        statements.push(`DROP TRIGGER IF EXISTS ${tableName}_ai;`);
        statements.push(
          `CREATE TRIGGER IF NOT EXISTS ${tableName}_ai AFTER INSERT ON ${q(tableName)} BEGIN\n` +
          `  INSERT INTO ${q(ftsTable)}(rowid, ${fieldList}) VALUES (new.id, ${newFields});\n` +
          `END;`
        );

        statements.push(`DROP TRIGGER IF EXISTS ${tableName}_au;`);
        statements.push(
          `CREATE TRIGGER IF NOT EXISTS ${tableName}_au AFTER UPDATE ON ${q(tableName)} BEGIN\n` +
          `  INSERT INTO ${q(ftsTable)}(${q(ftsTable)}, rowid, ${fieldList}) VALUES('delete', old.id, ${oldFields});\n` +
          `  INSERT INTO ${q(ftsTable)}(rowid, ${fieldList}) VALUES (new.id, ${newFields});\n` +
          `END;`
        );

        statements.push(`DROP TRIGGER IF EXISTS ${tableName}_ad;`);
        statements.push(
          `CREATE TRIGGER IF NOT EXISTS ${tableName}_ad AFTER DELETE ON ${q(tableName)} BEGIN\n` +
          `  INSERT INTO ${q(ftsTable)}(${q(ftsTable)}, rowid, ${fieldList}) VALUES('delete', old.id, ${oldFields});\n` +
          `END;`
        );

        // Rebuild index with existing data
        statements.push(
          `INSERT INTO ${q(ftsTable)}(${q(ftsTable)}) VALUES('rebuild');`
        );
      }
    }
  }

  return statements;
}
