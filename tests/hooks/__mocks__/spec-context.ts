/**
 * Mock Spec Context for hook tests.
 *
 * Provides mock implementations of spec, db, and crud for testing hooks.
 */

import type { KASAppSpec } from '../../../src/core/types/spec';
import type { DatabaseAdapter, RunResult } from '../../../src/data/database-adapter';
import type { CrudService } from '../../../src/data/crud-service';
import tutorSpec from '../../../assets/templates/tutor.json';

export const mockSpec = tutorSpec as unknown as KASAppSpec;

/**
 * Create a mock DatabaseAdapter with call tracking.
 */
export function createMockDb(): DatabaseAdapter & { calls: { method: string; args: any[] }[] } {
  const calls: { method: string; args: any[] }[] = [];

  return {
    calls,
    execRaw(sql: string) {
      calls.push({ method: 'execRaw', args: [sql] });
    },
    run(sql: string, params?: any[]): RunResult {
      calls.push({ method: 'run', args: [sql, params] });
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAll<T>(sql: string, params?: any[]): T[] {
      calls.push({ method: 'getAll', args: [sql, params] });
      return [] as T[];
    },
    getFirst<T>(sql: string, params?: any[]): T | null {
      calls.push({ method: 'getFirst', args: [sql, params] });
      return null;
    },
    transaction(fn: () => void) {
      calls.push({ method: 'transaction', args: [] });
      fn();
    },
  };
}

/**
 * Create a mock CrudService with controllable responses.
 */
export function createMockCrud(overrides: Partial<CrudService> = {}): CrudService {
  return {
    create: jest.fn(() => 1),
    read: jest.fn(() => null),
    update: jest.fn(() => true),
    archive: jest.fn(() => true),
    list: jest.fn(() => []),
    anchorQuery: jest.fn(() => []),
    storyEvents: jest.fn(() => []),
    calendarEvents: jest.fn(() => []),
    search: jest.fn(() => []),
    ...overrides,
  } as unknown as CrudService;
}

/**
 * Create a mock SpecContextValue with defaults.
 */
export function createMockSpecContext(overrides: {
  spec?: KASAppSpec | null;
  db?: DatabaseAdapter | null;
  crud?: CrudService | null;
  loading?: boolean;
  error?: string | null;
} = {}) {
  return {
    spec: overrides.spec ?? mockSpec,
    db: overrides.db ?? createMockDb(),
    crud: overrides.crud ?? createMockCrud(),
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
  };
}
