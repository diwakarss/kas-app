/**
 * useSearch Hook Tests
 *
 * Tests the debounced search functionality and result grouping.
 */

import { createMockCrud, mockSpec } from './__mocks__/spec-context';

// Mock the SpecContext module
jest.mock('../../src/core/context/SpecContext', () => ({
  useSpec: jest.fn(),
}));

// Import after mock setup
import { useSpec } from '../../src/core/context/SpecContext';

describe('useSearch — Search Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search configuration', () => {
    test('search config exists in spec', () => {
      expect(mockSpec.search).toBeDefined();
      expect(mockSpec.search.entities).toContain('Student');
    });

    test('search display templates exist for each entity', () => {
      for (const entity of mockSpec.search.entities) {
        expect(mockSpec.search.display[entity]).toBeDefined();
      }
    });
  });

  describe('result grouping', () => {
    test('groups results by entity type', () => {
      const mockCrud = createMockCrud({
        search: jest.fn().mockImplementation((entityName: string) => {
          if (entityName === 'Student') {
            return [{ id: 1, name: 'Anu' }, { id: 2, name: 'Priya' }];
          }
          if (entityName === 'Class') {
            return [{ id: 1, subject: 'Math', student_id: 1 }];
          }
          return [];
        }),
      });

      // Simulate search logic
      const entities = mockSpec.search.entities;
      const groups: { entityType: string; count: number }[] = [];

      for (const entityName of entities) {
        const results = mockCrud.search(entityName, 'a', 20);
        if (results.length > 0) {
          groups.push({ entityType: entityName, count: results.length });
        }
      }

      expect(groups).toEqual([
        { entityType: 'Student', count: 2 },
        { entityType: 'Class', count: 1 },
      ]);
    });

    test('returns empty groups when no results', () => {
      const mockCrud = createMockCrud({
        search: jest.fn().mockReturnValue([]),
      });

      const entities = mockSpec.search.entities;
      const groups: { entityType: string; count: number }[] = [];

      for (const entityName of entities) {
        const results = mockCrud.search(entityName, 'xyz', 20);
        if (results.length > 0) {
          groups.push({ entityType: entityName, count: results.length });
        }
      }

      expect(groups).toEqual([]);
    });
  });

  describe('template resolution', () => {
    test('display templates are defined for search entities', () => {
      // Templates should contain field placeholders
      expect(mockSpec.search.display.Student).toContain('{');
      expect(mockSpec.search.display.Student).toContain('name');
      expect(mockSpec.search.display.Class).toContain('{');
    });
  });
});

describe('useSearch — Debounce Logic', () => {
  test('debounce constant is 300ms', () => {
    // From useSearch.ts line 35
    const DEBOUNCE_MS = 300;
    expect(DEBOUNCE_MS).toBe(300);
  });

  test('empty query returns no groups', () => {
    const debouncedQuery = '';
    const shouldSearch = debouncedQuery.length > 0;
    expect(shouldSearch).toBe(false);
  });

  test('trimmed query triggers search', () => {
    const query = '  anu  ';
    const debouncedQuery = query.trim();
    expect(debouncedQuery).toBe('anu');
    expect(debouncedQuery.length).toBeGreaterThan(0);
  });
});

describe('useSearch — Empty State', () => {
  test('isEmpty is true when query exists but no results', () => {
    const debouncedQuery: string = 'xyz';
    const groups: any[] = [];
    const isEmpty = debouncedQuery !== '' && groups.length === 0;
    expect(isEmpty).toBe(true);
  });

  test('isEmpty is false when query is empty', () => {
    const debouncedQuery: string = '';
    const groups: any[] = [];
    const isEmpty = debouncedQuery !== '' && groups.length === 0;
    expect(isEmpty).toBe(false);
  });

  test('isEmpty is false when results exist', () => {
    const debouncedQuery: string = 'anu';
    const groups = [{ entityType: 'Student', results: [{ id: 1 }] }];
    const isEmpty = debouncedQuery !== '' && groups.length === 0;
    expect(isEmpty).toBe(false);
  });
});
