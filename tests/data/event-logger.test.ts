/**
 * Event Logger Tests — Wave 2 Bridge Work
 *
 * Tests for extended event envelope:
 * - change_class inference from event_type
 * - spec_version and policy_version from spec.meta
 * - diff_ref optional parameter
 */

import { logEvent, getEntityEvents } from '../../src/data/event-logger';
import type { DatabaseAdapter, RunResult } from '../../src/data/database-adapter';
import type { KASAppSpec } from '../../src/core/types/spec';

// Mock spec with version fields
const mockSpec: KASAppSpec = {
  meta: {
    spec_id: 'test-001',
    name: 'Test App',
    version: 1,
    business_type: 'test',
    created_date: '2026-01-01T00:00:00Z',
    base_template: 'test-v1',
    source: 'template',
    generation_confidence: 0.9,
    version_history: [],
    customizations: [],
    spec_version: 3,
    policy_version: 2,
  },
  entities: [],
  anchor: {} as any,
  story_events: {},
  add_flows: {},
  search: { entities: [], display: {} },
  calendar: {} as any,
  chat_commands: [],
  business_rules: [],
  computed_fields: {},
};

// Mock database adapter that captures SQL and params
interface MockDb extends DatabaseAdapter {
  lastInsert: { sql: string; params: any[] } | null;
}

function createMockDb(): MockDb {
  const mock: MockDb = {
    lastInsert: null,
    execRaw() {},
    run(sql: string, params?: any[]): RunResult {
      if (sql.includes('_events')) {
        mock.lastInsert = { sql, params: params || [] };
      }
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAll<T>(sql: string, params?: any[]): T[] {
      return [
        {
          id: 1,
          entity_type: 'Student',
          entity_id: 1,
          event_type: 'created',
          data_json: '{}',
          change_class: 'S',
          spec_version: 3,
          policy_version: 2,
          diff_ref: null,
          created_at: '2026-01-01 12:00:00',
        },
      ] as T[];
    },
    getFirst<T>(): T | null { return null; },
    transaction(fn: () => void) { fn(); },
  };
  return mock;
}

describe('Event Logger — change_class inference', () => {
  test('created events have change_class S (Small)', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created', { name: 'Test' });

    const params = db.lastInsert?.params;
    expect(params).toBeDefined();
    // Params order: entity_type, entity_id, event_type, data_json, change_class, spec_version, policy_version, diff_ref
    expect(params![4]).toBe('S');
  });

  test('updated events have change_class M (Mutation)', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'updated', { name: 'Updated' });

    const params = db.lastInsert?.params;
    expect(params![4]).toBe('M');
  });

  test('archived events have change_class M (Mutation)', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'archived');

    const params = db.lastInsert?.params;
    expect(params![4]).toBe('M');
  });

  test('change_class can be overridden via options', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created', { name: 'Test' }, { changeClass: 'R' });

    const params = db.lastInsert?.params;
    expect(params![4]).toBe('R');
  });
});

describe('Event Logger — version tracking', () => {
  test('spec_version is read from spec.meta.spec_version', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created');

    const params = db.lastInsert?.params;
    // spec_version is at index 5
    expect(params![5]).toBe(3);
  });

  test('policy_version is read from spec.meta.policy_version', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created');

    const params = db.lastInsert?.params;
    // policy_version is at index 6
    expect(params![6]).toBe(2);
  });

  test('spec_version falls back to meta.version if spec_version undefined', () => {
    const specWithoutSpecVersion: KASAppSpec = {
      ...mockSpec,
      meta: {
        ...mockSpec.meta,
        spec_version: undefined,
      },
    };

    const db = createMockDb();
    logEvent(db, specWithoutSpecVersion, 'Student', 1, 'created');

    const params = db.lastInsert?.params;
    expect(params![5]).toBe(1); // Falls back to meta.version
  });

  test('policy_version defaults to 1 if undefined', () => {
    const specWithoutPolicyVersion: KASAppSpec = {
      ...mockSpec,
      meta: {
        ...mockSpec.meta,
        policy_version: undefined,
      },
    };

    const db = createMockDb();
    logEvent(db, specWithoutPolicyVersion, 'Student', 1, 'created');

    const params = db.lastInsert?.params;
    expect(params![6]).toBe(1); // Defaults to 1
  });
});

describe('Event Logger — diff_ref', () => {
  test('diff_ref is null by default', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created');

    const params = db.lastInsert?.params;
    // diff_ref is at index 7
    expect(params![7]).toBeNull();
  });

  test('diff_ref can be set via options', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'updated', { name: 'New' }, {
      diffRef: 'patch_abc123',
    });

    const params = db.lastInsert?.params;
    expect(params![7]).toBe('patch_abc123');
  });
});

describe('Event Logger — SQL structure', () => {
  test('INSERT includes all extended envelope columns', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created');

    const sql = db.lastInsert?.sql;
    expect(sql).toContain('change_class');
    expect(sql).toContain('spec_version');
    expect(sql).toContain('policy_version');
    expect(sql).toContain('diff_ref');
  });

  test('data is serialized to JSON', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'created', { name: 'Test', fee: 500 });

    const params = db.lastInsert?.params;
    // data_json is at index 3
    expect(params![3]).toBe('{"name":"Test","fee":500}');
  });

  test('data can be omitted (null)', () => {
    const db = createMockDb();
    logEvent(db, mockSpec, 'Student', 1, 'archived');

    const params = db.lastInsert?.params;
    expect(params![3]).toBeNull();
  });
});

describe('Event Logger — getEntityEvents', () => {
  test('retrieves events for entity', () => {
    const db = createMockDb();
    const events = getEntityEvents(db, 'Student', 1);

    expect(events.length).toBe(1);
    expect(events[0].entity_type).toBe('Student');
    expect(events[0].change_class).toBe('S');
  });
});
