/**
 * Query Builder Tests
 *
 * Validates parameterized SQL generation for all query types.
 */

import {
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
  toTableName,
} from '../../src/data/query-builder';

describe('Query Builder — toTableName', () => {
  test('lowercases entity name', () => {
    expect(toTableName('Student')).toBe('student');
    expect(toTableName('Class')).toBe('class');
  });
});

describe('Query Builder — buildListQuery', () => {
  test('basic list excludes archived by default', () => {
    const q = buildListQuery('student');
    expect(q.sql).toBe('SELECT * FROM "student" WHERE archived = 0');
    expect(q.params).toEqual([]);
  });

  test('list with includeArchived', () => {
    const q = buildListQuery('student', { includeArchived: true });
    expect(q.sql).toBe('SELECT * FROM "student"');
    expect(q.params).toEqual([]);
  });

  test('list with filters', () => {
    const q = buildListQuery('class', {
      filters: [
        { field: 'student_id', op: '=', value: 5 },
        { field: 'status', op: '=', value: 'scheduled' },
      ],
    });
    expect(q.sql).toContain('archived = 0');
    expect(q.sql).toContain('student_id = ?');
    expect(q.sql).toContain('status = ?');
    expect(q.params).toEqual([5, 'scheduled']);
  });

  test('list with ordering', () => {
    const q = buildListQuery('class', { orderBy: 'datetime', orderDir: 'ASC' });
    expect(q.sql).toContain('ORDER BY datetime ASC');
  });

  test('list with limit and offset', () => {
    const q = buildListQuery('student', { limit: 10, offset: 20 });
    expect(q.sql).toContain('LIMIT ?');
    expect(q.sql).toContain('OFFSET ?');
    expect(q.params).toEqual([10, 20]);
  });
});

describe('Query Builder — buildGetByIdQuery', () => {
  test('generates parameterized SELECT by id', () => {
    const q = buildGetByIdQuery('student', 42);
    expect(q.sql).toBe('SELECT * FROM "student" WHERE id = ?');
    expect(q.params).toEqual([42]);
  });
});

describe('Query Builder — buildInsertQuery', () => {
  test('generates parameterized INSERT', () => {
    const q = buildInsertQuery('student', { name: 'Priya', hourly_fee: 500 });
    expect(q.sql).toBe('INSERT INTO "student" (name, hourly_fee) VALUES (?, ?)');
    expect(q.params).toEqual(['Priya', 500]);
  });

  test('handles single field', () => {
    const q = buildInsertQuery('note', { content: 'Test note' });
    expect(q.sql).toBe('INSERT INTO "note" (content) VALUES (?)');
    expect(q.params).toEqual(['Test note']);
  });
});

describe('Query Builder — buildUpdateQuery', () => {
  test('generates parameterized UPDATE with updated_at', () => {
    const q = buildUpdateQuery('student', 5, { name: 'Priya Updated', hourly_fee: 600 });
    expect(q.sql).toContain('UPDATE "student" SET');
    expect(q.sql).toContain('name = ?');
    expect(q.sql).toContain('hourly_fee = ?');
    expect(q.sql).toContain("updated_at = datetime('now')");
    expect(q.sql).toContain('WHERE id = ?');
    expect(q.params).toEqual(['Priya Updated', 600, 5]);
  });
});

describe('Query Builder — buildArchiveQuery', () => {
  test('generates soft-delete UPDATE', () => {
    const q = buildArchiveQuery('student', 5);
    expect(q.sql).toContain('archived = 1');
    expect(q.sql).toContain("updated_at = datetime('now')");
    expect(q.sql).toContain('WHERE id = ?');
    expect(q.params).toEqual([5]);
  });
});

describe('Query Builder — buildAnchorQuery', () => {
  test('basic anchor query without join', () => {
    const q = buildAnchorQuery('class', 'datetime');
    expect(q.sql).toContain('SELECT * FROM "class"');
    expect(q.sql).toContain("date(\"class\".datetime) = date('now')");
    expect(q.sql).toContain('archived = 0');
  });

  test('anchor query with time ordering', () => {
    const q = buildAnchorQuery('class', 'datetime', 'time');
    expect(q.sql).toContain('ORDER BY "class".time ASC');
  });

  test('anchor query with JOIN', () => {
    const q = buildAnchorQuery('class', 'datetime', 'time', 'student', 'student_id');
    expect(q.sql).toContain('LEFT JOIN "student" ON "class".student_id = "student".id');
    expect(q.sql).toContain('"student".name as _related_name');
  });
});

describe('Query Builder — SQL Injection Protection', () => {
  test('values are always parameterized, never interpolated', () => {
    const q = buildListQuery('student', {
      filters: [{ field: 'name', op: '=', value: "'; DROP TABLE student; --" }],
    });
    // The malicious string should be in params, NOT in the SQL
    expect(q.sql).not.toContain('DROP TABLE');
    expect(q.params).toContain("'; DROP TABLE student; --");
  });
});

// ──────────────────────────────────────────
// Phase B query builders
// ──────────────────────────────────────────

describe('Query Builder — buildStorySourceQuery', () => {
  test('single source with filter', () => {
    const q = buildStorySourceQuery(
      { sourceTable: 'class', relationship: 'student_id', dateField: 'datetime', filter: { field: 'status', value: 'completed' }, eventType: 'completed' },
      1
    );
    expect(q.sql).toContain("'class' AS _source_entity");
    expect(q.sql).toContain("'completed' AS _event_type");
    expect(q.sql).toContain('student_id = ?');
    expect(q.sql).toContain('status = ?');
    expect(q.sql).toContain('ORDER BY datetime DESC');
    expect(q.params).toEqual([1, 'completed']);
  });

  test('source without filter', () => {
    const q = buildStorySourceQuery(
      { sourceTable: 'payment', relationship: 'student_id', dateField: 'date', eventType: 'received' },
      5
    );
    expect(q.sql).toContain("'payment' AS _source_entity");
    expect(q.sql).toContain("'received' AS _event_type");
    expect(q.sql).toContain('student_id = ?');
    expect(q.sql).not.toContain('AND status');
    expect(q.sql).toContain('ORDER BY date DESC');
    expect(q.params).toEqual([5]);
  });

  test('includes _sort_date alias', () => {
    const q = buildStorySourceQuery(
      { sourceTable: 'class', relationship: 'student_id', dateField: 'datetime', eventType: 'all' },
      1
    );
    expect(q.sql).toContain('datetime AS _sort_date');
  });

  test('excludes archived records', () => {
    const q = buildStorySourceQuery(
      { sourceTable: 'note', relationship: 'student_id', dateField: 'date', eventType: 'note' },
      1
    );
    expect(q.sql).toContain('archived = 0');
  });
});

describe('Query Builder — buildCalendarQuery', () => {
  test('generates month range query', () => {
    const q = buildCalendarQuery('class', 'datetime', 2026, 1);
    expect(q.sql).toContain('date("class".datetime) >= ?');
    expect(q.sql).toContain('date("class".datetime) < ?');
    expect(q.params).toContain('2026-01-01');
    expect(q.params).toContain('2026-02-01');
    expect(q.sql).toContain('ORDER BY "class".datetime ASC');
  });

  test('handles December to January boundary', () => {
    const q = buildCalendarQuery('class', 'datetime', 2026, 12);
    expect(q.params).toContain('2026-12-01');
    expect(q.params).toContain('2027-01-01');
  });

  test('with JOIN', () => {
    const q = buildCalendarQuery('class', 'datetime', 2026, 3, 'student', 'student_id');
    expect(q.sql).toContain('LEFT JOIN "student" ON "class".student_id = "student".id');
    expect(q.sql).toContain('_related_name');
  });

  test('excludes archived', () => {
    const q = buildCalendarQuery('class', 'datetime', 2026, 6);
    expect(q.sql).toContain('"class".archived = 0');
  });
});

describe('Query Builder — buildSearchQuery', () => {
  test('generates FTS5 MATCH query', () => {
    const q = buildSearchQuery('student', 'Priya');
    expect(q.sql).toContain('student_fts');
    expect(q.sql).toContain('MATCH ?');
    expect(q.params[0]).toBe('Priya*');
    expect(q.sql).toContain('archived = 0');
  });

  test('joins main table for full row data', () => {
    const q = buildSearchQuery('student', 'test');
    expect(q.sql).toContain('JOIN "student" ON "student_fts".rowid = "student".id');
  });

  test('with related entity JOIN', () => {
    const q = buildSearchQuery('class', 'Scales', 20, 'student', 'student_id');
    expect(q.sql).toContain('LEFT JOIN "student" ON "class".student_id = "student".id');
  });

  test('strips quotes from search term for safety', () => {
    const q = buildSearchQuery('student', "O'Brien");
    expect(q.params[0]).toBe('OBrien*');
  });

  test('applies limit', () => {
    const q = buildSearchQuery('student', 'test', 10);
    expect(q.sql).toContain('LIMIT ?');
    expect(q.params).toContain(10);
  });
});

// ──────────────────────────────────────────
// Phase C: LIKE-based search fallback (web)
// ──────────────────────────────────────────

describe('Query Builder — buildSearchQueryFallback', () => {
  test('generates LIKE-based query across searchable fields', () => {
    const q = buildSearchQueryFallback('student', 'Priya', ['name', 'phone']);
    expect(q.sql).toContain('"student".name LIKE ?');
    expect(q.sql).toContain('"student".phone LIKE ?');
    expect(q.sql).toContain(' OR ');
    expect(q.params[0]).toBe('%Priya%');
    expect(q.params[1]).toBe('%Priya%');
  });

  test('excludes archived records', () => {
    const q = buildSearchQueryFallback('student', 'test', ['name']);
    expect(q.sql).toContain('"student".archived = 0');
  });

  test('applies limit', () => {
    const q = buildSearchQueryFallback('student', 'test', ['name'], 15);
    expect(q.sql).toContain('LIMIT ?');
    expect(q.params).toContain(15);
  });

  test('with join target', () => {
    const q = buildSearchQueryFallback('class', 'Scales', ['subject'], 20, 'student', 'student_id');
    expect(q.sql).toContain('LEFT JOIN "student" ON "class".student_id = "student".id');
    expect(q.sql).toContain('"student".name AS _related_name');
  });

  test('strips quotes from search term', () => {
    const q = buildSearchQueryFallback('student', "O'Brien", ['name']);
    expect(q.params[0]).toBe('%OBrien%');
  });

  test('works with single searchable field', () => {
    const q = buildSearchQueryFallback('note', 'hello', ['content']);
    expect(q.sql).toContain('"note".content LIKE ?');
    expect(q.sql).not.toContain(' OR ');
  });
});
