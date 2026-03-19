/**
 * Performance benchmarks for Phase D requirements:
 * PF-1: Story timeline — 1000+ events processable
 * PF-2: Search query — <200ms for 500+ records
 * PF-3: Computed fields — <50ms per entity evaluation
 */

import { evaluateComputedFields } from '../../src/engines/computed-field-engine';
import { buildSearchQueryFallback } from '../../src/data/query-builder';

// Minimal spec fixture for computed field benchmarks
const benchSpec = {
  meta: { name: 'Bench', version: '1.0', icon: 'T', color_scheme: 'warm' },
  entities: [
    {
      name: 'Student',
      display_name: 'Student',
      icon: 'S',
      fields: [
        { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
        { name: 'phone', display_name: 'Phone', type: 'phone', required: false, searchable: true },
      ],
      relationships: [{ type: 'has_many', target: 'Class', foreign_key: 'student_id' }],
    },
    {
      name: 'Class',
      display_name: 'Class',
      icon: 'C',
      fields: [
        { name: 'student_id', display_name: 'Student', type: 'text', required: true, searchable: false },
        { name: 'datetime', display_name: 'Date', type: 'datetime', required: true, searchable: false },
        { name: 'duration', display_name: 'Duration', type: 'duration', required: true, searchable: false, default_value: 60 },
      ],
      relationships: [{ type: 'belongs_to', target: 'Student', foreign_key: 'student_id' }],
    },
    {
      name: 'Payment',
      display_name: 'Payment',
      icon: 'P',
      fields: [
        { name: 'student_id', display_name: 'Student', type: 'text', required: true, searchable: false },
        { name: 'amount', display_name: 'Amount', type: 'currency', required: true, searchable: false },
        { name: 'date', display_name: 'Date', type: 'date', required: true, searchable: false },
      ],
      relationships: [{ type: 'belongs_to', target: 'Student', foreign_key: 'student_id' }],
    },
  ],
  computed_fields: {
    Student: [
      { name: 'total_classes', display_name: 'Total Classes', type: 'count', source_entity: 'Class', relationship: 'student_id' },
      { name: 'total_paid', display_name: 'Total Paid', type: 'sum', source_entity: 'Payment', source_field: 'amount', relationship: 'student_id' },
    ],
  },
  anchor: { entity: 'Class', type: 'day_schedule', greeting_template: 'Hi', date_label: 'Today', card_display: { title: '{name}', subtitle: '', time_field: 'datetime' }, empty_state: { message: 'None' }, summary: { stats: [] } },
  add_flows: {},
  story_events: {},
  business_rules: [],
  calendar: { entity: 'Class', date_field: 'datetime' },
  search: { entities: ['Student'] },
} as any;

// Mock database adapter for benchmarks
function createBenchDb() {
  const initSqlJs = require('sql.js');
  // sql.js is loaded synchronously in tests (node env)
  let SQL: any;
  let db: any;

  return {
    async init() {
      SQL = await initSqlJs();
      db = new SQL.Database();
      // Create tables
      db.run(`CREATE TABLE student (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
      db.run(`CREATE TABLE class (id INTEGER PRIMARY KEY, student_id INTEGER, datetime TEXT, duration INTEGER DEFAULT 60, topic TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
      db.run(`CREATE TABLE payment (id INTEGER PRIMARY KEY, student_id INTEGER, amount REAL, date TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
    },
    seedStudents(count: number) {
      for (let i = 1; i <= count; i++) {
        db.run(`INSERT INTO student (name, phone) VALUES (?, ?)`, [`Student ${i}`, `555${String(i).padStart(4, '0')}`]);
      }
    },
    seedClasses(count: number, studentCount: number) {
      for (let i = 1; i <= count; i++) {
        const sid = (i % studentCount) + 1;
        const date = new Date(2026, 0, 1 + (i % 30));
        db.run(`INSERT INTO class (student_id, datetime, duration) VALUES (?, ?, ?)`, [sid, date.toISOString(), 60]);
      }
    },
    seedPayments(count: number, studentCount: number) {
      for (let i = 1; i <= count; i++) {
        const sid = (i % studentCount) + 1;
        const date = new Date(2026, 0, 1 + (i % 30));
        db.run(`INSERT INTO payment (student_id, amount, date) VALUES (?, ?, ?)`, [sid, 500 + (i % 1000), date.toISOString().split('T')[0]]);
      }
    },
    // DatabaseAdapter interface
    getAdapter() {
      return {
        execRaw(sql: string) { db.run(sql); },
        run(sql: string, params?: any[]) {
          db.run(sql, params);
          const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0;
          const changes = db.getRowsModified();
          return { lastInsertRowId: lastId, changes };
        },
        getAll<T>(sql: string, params?: any[]): T[] {
          const stmt = db.prepare(sql);
          if (params) stmt.bind(params);
          const rows: T[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject() as T);
          }
          stmt.free();
          return rows;
        },
        getFirst<T>(sql: string, params?: any[]): T | null {
          const all = this.getAll<T>(sql, params);
          return all.length > 0 ? all[0] : null;
        },
        transaction(fn: () => void) { fn(); },
      };
    },
    close() { db.close(); },
  };
}

describe('Performance Benchmarks', () => {
  let benchDb: ReturnType<typeof createBenchDb>;

  beforeAll(async () => {
    benchDb = createBenchDb();
    await benchDb.init();
  });

  afterAll(() => {
    benchDb.close();
  });

  describe('PF-1: Story timeline event processing', () => {
    it('should handle 1000+ event records in processing', async () => {
      benchDb.seedStudents(10);
      benchDb.seedClasses(1000, 10);

      const adapter = benchDb.getAdapter();
      const start = performance.now();
      const rows = adapter.getAll('SELECT * FROM class WHERE archived = 0 ORDER BY datetime DESC LIMIT 1000');
      const elapsed = performance.now() - start;

      expect(rows.length).toBe(1000);
      expect(elapsed).toBeLessThan(500); // 500ms budget for 1000 rows
    });

    it('should paginate 50-event chunks efficiently', () => {
      const adapter = benchDb.getAdapter();
      const start = performance.now();
      for (let page = 0; page < 20; page++) {
        adapter.getAll('SELECT * FROM class WHERE archived = 0 ORDER BY datetime DESC LIMIT 50 OFFSET ?', [page * 50]);
      }
      const elapsed = performance.now() - start;

      // 20 pages * 50 = 1000 events, should be fast
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('PF-2: Search query performance', () => {
    it('should search 500+ records via LIKE fallback in <200ms', () => {
      // Already have 10 students seeded
      benchDb.seedStudents(500); // total now 510

      const adapter = benchDb.getAdapter();
      const query = buildSearchQueryFallback('student', 'Student 4', ['name', 'phone'], 20);

      const start = performance.now();
      const results = adapter.getAll(query.sql, query.params);
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('PF-3: Computed field evaluation', () => {
    it('should evaluate computed fields for 1 entity in <50ms', () => {
      const adapter = benchDb.getAdapter();

      const start = performance.now();
      const computed = evaluateComputedFields('Student', 1, benchSpec, adapter, { id: 1, name: 'Student 1' });
      const elapsed = performance.now() - start;

      expect(computed).toHaveProperty('total_classes');
      expect(computed).toHaveProperty('total_paid');
      expect(elapsed).toBeLessThan(50);
    });

    it('should evaluate computed fields for 50 entities in <500ms', () => {
      const adapter = benchDb.getAdapter();

      const start = performance.now();
      for (let i = 1; i <= 50; i++) {
        evaluateComputedFields('Student', i, benchSpec, adapter, { id: i, name: `Student ${i}` });
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });
});
