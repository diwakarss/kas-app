/**
 * CRUD Service Tests
 *
 * Uses a mock DatabaseAdapter to verify CRUD operations,
 * event logging, and cache invalidation.
 */

import { CrudService } from '../../src/data/crud-service';
import type { DatabaseAdapter, RunResult } from '../../src/data/database-adapter';
import type { KASAppSpec } from '../../src/core/types/spec';
import tutorSpec from '../../assets/tutor-spec.json';
import { invalidateCache } from '../../src/engines/computed-field-engine';

const spec = tutorSpec as unknown as KASAppSpec;

// ──────────────────────────────────────────
// Mock Database Adapter
// ──────────────────────────────────────────

function createMockDb(): DatabaseAdapter & { calls: { method: string; args: any[] }[] } {
  const calls: { method: string; args: any[] }[] = [];
  let nextId = 1;

  return {
    calls,
    execRaw(sql: string) {
      calls.push({ method: 'execRaw', args: [sql] });
    },
    run(sql: string, params?: any[]): RunResult {
      calls.push({ method: 'run', args: [sql, params] });
      return { changes: 1, lastInsertRowId: nextId++ };
    },
    getAll<T>(sql: string, params?: any[]): T[] {
      calls.push({ method: 'getAll', args: [sql, params] });
      // Return empty array by default
      return [] as T[];
    },
    getFirst<T>(sql: string, params?: any[]): T | null {
      calls.push({ method: 'getFirst', args: [sql, params] });
      // Return mock student data for reads
      if (sql.includes('student') && sql.includes('WHERE id')) {
        return { id: 1, name: 'Priya', hourly_fee: 500 } as T;
      }
      return null;
    },
    transaction(fn: () => void) {
      calls.push({ method: 'transaction', args: [] });
      fn();
    },
  };
}

describe('CrudService — Create', () => {
  test('creates entity and returns ID', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    const id = crud.create('Student', { name: 'Priya', hourly_fee: 500 });
    expect(id).toBe(1);
  });

  test('create logs an event', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.create('Student', { name: 'Priya', hourly_fee: 500 });

    // First call: INSERT into student
    // Second call: INSERT into _events
    const eventInsert = db.calls.find(
      (c) => c.method === 'run' && c.args[0].includes('_events')
    );
    expect(eventInsert).toBeDefined();
    expect(eventInsert!.args[1]).toContain('Student');
    expect(eventInsert!.args[1]).toContain('created');
  });

  test('create generates sequential IDs', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    const id1 = crud.create('Student', { name: 'A' });
    const id2 = crud.create('Student', { name: 'B' });
    expect(id2).toBeGreaterThan(id1);
  });
});

describe('CrudService — Read', () => {
  test('reads entity by ID', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    const result = crud.read('Student', 1);
    expect(result).toBeDefined();

    const readCall = db.calls.find(
      (c) => c.method === 'getFirst' && c.args[0].includes('student')
    );
    expect(readCall).toBeDefined();
    expect(readCall!.args[1]).toEqual([1]);
  });
});

describe('CrudService — List', () => {
  test('lists entities with default options (excludes archived)', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.list('Student');

    const listCall = db.calls.find(
      (c) => c.method === 'getAll' && c.args[0].includes('student')
    );
    expect(listCall).toBeDefined();
    expect(listCall!.args[0]).toContain('archived = 0');
  });

  test('lists with filters', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.list('Class', {
      filters: [{ field: 'student_id', op: '=', value: 5 }],
    });

    const listCall = db.calls.find(
      (c) => c.method === 'getAll' && c.args[0].includes('class')
    );
    expect(listCall).toBeDefined();
    expect(listCall!.args[0]).toContain('student_id = ?');
    expect(listCall!.args[1]).toContain(5);
  });
});

describe('CrudService — Update', () => {
  test('updates entity and logs event', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    const changes = crud.update('Student', 1, { name: 'Priya Updated' });
    expect(changes).toBe(1);

    const eventInsert = db.calls.find(
      (c) => c.method === 'run' && c.args[0].includes('_events')
    );
    expect(eventInsert).toBeDefined();
    expect(eventInsert!.args[1]).toContain('updated');
  });

  test('update SQL includes updated_at', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.update('Student', 1, { hourly_fee: 600 });

    const updateCall = db.calls.find(
      (c) => c.method === 'run' && c.args[0].includes('UPDATE')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall!.args[0]).toContain("updated_at = datetime('now')");
  });
});

describe('CrudService — Archive', () => {
  test('archives entity (soft delete)', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    const changes = crud.archive('Student', 1);
    expect(changes).toBe(1);

    const archiveCall = db.calls.find(
      (c) => c.method === 'run' && c.args[0].includes('archived = 1')
    );
    expect(archiveCall).toBeDefined();
  });

  test('archive logs an event', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.archive('Student', 1);

    const eventCalls = db.calls.filter(
      (c) => c.method === 'run' && c.args[0].includes('_events')
    );
    expect(eventCalls.length).toBeGreaterThan(0);
    const archiveEvent = eventCalls.find((c) => c.args[1]?.includes('archived'));
    expect(archiveEvent).toBeDefined();
  });
});

describe('CrudService — Anchor Query', () => {
  test('anchor query filters by today', () => {
    const db = createMockDb();
    const crud = new CrudService(db, spec);

    crud.anchorQuery('datetime', 'time', 'student', 'student_id');

    const anchorCall = db.calls.find(
      (c) => c.method === 'getAll' && c.args[0].includes("date('now')")
    );
    expect(anchorCall).toBeDefined();
    expect(anchorCall!.args[0]).toContain('class');
    expect(anchorCall!.args[0]).toContain('LEFT JOIN "student"');
  });
});
