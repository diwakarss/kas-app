/**
 * Schema Migration Tests
 *
 * Verifies generateMigration() detects new fields and generates
 * ALTER TABLE ADD COLUMN + FTS5 rebuild statements.
 *
 * Uses the InMemoryDatabaseAdapter for real SQL execution.
 */

import initSqlJs from 'sql.js';
import { InMemoryDatabaseAdapter } from '../../src/data/in-memory-database-adapter';
import { generateDDL, generateMigration } from '../../src/engines/schema-engine';
import type { KASAppSpec, Entity } from '../../src/core/types/spec';

function makeSpec(entities: Entity[]): KASAppSpec {
  return {
    meta: {
      spec_id: 'mig-test',
      name: 'Migration Test',
      version: 1,
      business_type: 'test',
      created_date: '2026-01-01',
      base_template: 'test-v1',
      source: 'template',
      generation_confidence: 0.9,
      version_history: [],
      customizations: [],
    },
    entities,
    anchor: {} as any,
    story_events: {},
    add_flows: {},
    search: { entities: [], display: {} },
    calendar: {} as any,
    chat_commands: [],
    business_rules: [],
    computed_fields: {},
  };
}

let adapter: InMemoryDatabaseAdapter;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  adapter = new InMemoryDatabaseAdapter(db);
});

describe('Schema Migration — generateMigration', () => {
  test('returns empty array when no changes needed', () => {
    const spec = makeSpec([
      {
        name: 'Student',
        display_name: 'Student',
        display_name_plural: 'Students',
        icon: '🎓',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);

    // Create the schema first
    const ddl = generateDDL(spec);
    for (const stmt of ddl) {
      adapter.execRaw(stmt);
    }

    // Same spec — no migration needed
    const migration = generateMigration(adapter, spec);
    expect(migration).toEqual([]);
  });

  test('detects new fields and generates ALTER TABLE', () => {
    // V1: only name
    const specV1 = makeSpec([
      {
        name: 'Student',
        display_name: 'Student',
        display_name_plural: 'Students',
        icon: '🎓',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);

    const ddl = generateDDL(specV1);
    for (const stmt of ddl) {
      adapter.execRaw(stmt);
    }

    // V2: add phone and fee
    const specV2 = makeSpec([
      {
        name: 'Student',
        display_name: 'Student',
        display_name_plural: 'Students',
        icon: '🎓',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
          { name: 'phone', display_name: 'Phone', type: 'phone', required: false, searchable: false },
          { name: 'fee', display_name: 'Fee', type: 'currency', required: false, searchable: false },
        ],
        relationships: [],
      },
    ]);

    const migration = generateMigration(adapter, specV2);
    expect(migration.length).toBe(2);
    expect(migration[0]).toContain('ALTER TABLE "student" ADD COLUMN phone TEXT');
    expect(migration[1]).toContain('ALTER TABLE "student" ADD COLUMN fee REAL');
  });

  test('generated ALTER TABLE statements execute successfully', () => {
    // V1: name only
    const specV1 = makeSpec([
      {
        name: 'Product',
        display_name: 'Product',
        display_name_plural: 'Products',
        icon: '📦',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);

    for (const stmt of generateDDL(specV1)) {
      adapter.execRaw(stmt);
    }

    // Insert data before migration
    adapter.run('INSERT INTO "product" (name) VALUES (?)', ['Widget']);

    // V2: add price
    const specV2 = makeSpec([
      {
        name: 'Product',
        display_name: 'Product',
        display_name_plural: 'Products',
        icon: '📦',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
          { name: 'price', display_name: 'Price', type: 'currency', required: false, searchable: false },
        ],
        relationships: [],
      },
    ]);

    const migration = generateMigration(adapter, specV2);
    for (const stmt of migration) {
      adapter.execRaw(stmt);
    }

    // Existing data preserved, new column is NULL
    const row = adapter.getFirst<{ name: string; price: number | null }>('SELECT * FROM "product" WHERE id = 1');
    expect(row!.name).toBe('Widget');
    expect(row!.price).toBeNull();

    // New data can use the column
    adapter.run('INSERT INTO "product" (name, price) VALUES (?, ?)', ['Gadget', 29.99]);
    const newRow = adapter.getFirst<{ price: number }>('SELECT * FROM "product" WHERE name = ?', ['Gadget']);
    expect(newRow!.price).toBe(29.99);
  });

  test('rebuilds FTS5 when new searchable fields added', () => {
    // V1: name is searchable — skip FTS5 DDL (sql.js lacks FTS5 module)
    const specV1 = makeSpec([
      {
        name: 'Customer',
        display_name: 'Customer',
        display_name_plural: 'Customers',
        icon: '👤',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
        ],
        relationships: [],
      },
    ]);

    // Only execute non-FTS5 statements (sql.js doesn't compile FTS5)
    for (const stmt of generateDDL(specV1)) {
      if (stmt.includes('fts5') || stmt.includes('_fts')) continue;
      adapter.execRaw(stmt);
    }

    // V2: add phone as searchable
    const specV2 = makeSpec([
      {
        name: 'Customer',
        display_name: 'Customer',
        display_name_plural: 'Customers',
        icon: '👤',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
          { name: 'phone', display_name: 'Phone', type: 'phone', required: false, searchable: true },
        ],
        relationships: [],
      },
    ]);

    const migration = generateMigration(adapter, specV2);

    // Verify correct SQL statements are generated (don't execute — FTS5 not in sql.js)
    expect(migration.some((s) => s.includes('ALTER TABLE "customer" ADD COLUMN phone'))).toBe(true);
    expect(migration.some((s) => s.includes('DROP TABLE IF EXISTS "customer_fts"'))).toBe(true);
    expect(migration.some((s) => s.includes('"customer_fts" USING fts5'))).toBe(true);
    expect(migration.some((s) => s.includes('customer_ai'))).toBe(true);
    expect(migration.some((s) => s.includes('customer_au'))).toBe(true);
    expect(migration.some((s) => s.includes('customer_ad'))).toBe(true);
    expect(migration.some((s) => s.includes("VALUES('rebuild')"))).toBe(true);
  });

  test('skips entities whose tables do not exist yet', () => {
    // Don't create any tables — just run migration
    const spec = makeSpec([
      {
        name: 'Ghost',
        display_name: 'Ghost',
        display_name_plural: 'Ghosts',
        icon: '👻',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);

    const migration = generateMigration(adapter, spec);
    expect(migration).toEqual([]);
  });

  test('handles FK fields correctly in migration', () => {
    // V1: just parent (avoid "Order" — reserved SQL keyword)
    const specV1 = makeSpec([
      {
        name: 'Customer',
        display_name: 'Customer',
        display_name_plural: 'Customers',
        icon: '👤',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
      {
        name: 'Purchase',
        display_name: 'Purchase',
        display_name_plural: 'Purchases',
        icon: '📋',
        fields: [
          { name: 'customer_id', display_name: 'Customer', type: 'number', required: true, searchable: false },
        ],
        relationships: [
          { target: 'Customer', type: 'belongs_to', foreign_key: 'customer_id', display_in_story: false },
        ],
      },
    ]);

    for (const stmt of generateDDL(specV1)) {
      adapter.execRaw(stmt);
    }

    // V2: add amount field to Purchase
    const specV2 = makeSpec([
      {
        name: 'Customer',
        display_name: 'Customer',
        display_name_plural: 'Customers',
        icon: '👤',
        fields: [
          { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
      {
        name: 'Purchase',
        display_name: 'Purchase',
        display_name_plural: 'Purchases',
        icon: '📋',
        fields: [
          { name: 'customer_id', display_name: 'Customer', type: 'number', required: true, searchable: false },
          { name: 'amount', display_name: 'Amount', type: 'currency', required: true, searchable: false },
        ],
        relationships: [
          { target: 'Customer', type: 'belongs_to', foreign_key: 'customer_id', display_in_story: false },
        ],
      },
    ]);

    const migration = generateMigration(adapter, specV2);
    expect(migration.length).toBe(1);
    expect(migration[0]).toContain('ALTER TABLE "purchase" ADD COLUMN amount REAL');
  });

  test('does not re-add existing system columns', () => {
    const spec = makeSpec([
      {
        name: 'Item',
        display_name: 'Item',
        display_name_plural: 'Items',
        icon: '📦',
        fields: [
          { name: 'title', display_name: 'Title', type: 'text', required: true, searchable: false },
        ],
        relationships: [],
      },
    ]);

    for (const stmt of generateDDL(spec)) {
      adapter.execRaw(stmt);
    }

    // Same spec — system columns (id, created_at, updated_at, archived) already exist
    const migration = generateMigration(adapter, spec);
    expect(migration).toEqual([]);
    expect(migration.some((s) => s.includes('created_at'))).toBe(false);
    expect(migration.some((s) => s.includes('updated_at'))).toBe(false);
  });
});
