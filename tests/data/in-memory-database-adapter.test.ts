/**
 * In-Memory Database Adapter Tests
 *
 * Verifies the sql.js-based adapter implements DatabaseAdapter correctly:
 * CRUD cycle, transactions, parameterized queries.
 */

import initSqlJs from 'sql.js';
import { InMemoryDatabaseAdapter } from '../../src/data/in-memory-database-adapter';

let adapter: InMemoryDatabaseAdapter;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  adapter = new InMemoryDatabaseAdapter(db);
});

describe('InMemoryDatabaseAdapter — execRaw', () => {
  test('creates a table', () => {
    adapter.execRaw('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    const rows = adapter.getAll('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'test']);
    expect(rows.length).toBe(1);
  });

  test('runs multiple DDL statements sequentially', () => {
    adapter.execRaw('CREATE TABLE a (id INTEGER PRIMARY KEY)');
    adapter.execRaw('CREATE TABLE b (id INTEGER PRIMARY KEY)');
    const rows = adapter.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    const names = rows.map((r) => r.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
  });
});

describe('InMemoryDatabaseAdapter — run', () => {
  beforeEach(() => {
    adapter.execRaw('CREATE TABLE student (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, fee REAL)');
  });

  test('inserts a row and returns lastInsertRowId', () => {
    const result = adapter.run('INSERT INTO student (name, fee) VALUES (?, ?)', ['Priya', 500]);
    expect(result.lastInsertRowId).toBe(1);
    expect(result.changes).toBe(1);
  });

  test('returns sequential IDs', () => {
    const r1 = adapter.run('INSERT INTO student (name) VALUES (?)', ['A']);
    const r2 = adapter.run('INSERT INTO student (name) VALUES (?)', ['B']);
    expect(r2.lastInsertRowId).toBe(r1.lastInsertRowId + 1);
  });

  test('updates a row and reports changes', () => {
    adapter.run('INSERT INTO student (name) VALUES (?)', ['Alice']);
    const result = adapter.run('UPDATE student SET name = ? WHERE id = ?', ['Bob', 1]);
    expect(result.changes).toBe(1);
  });

  test('reports 0 changes when no rows match', () => {
    const result = adapter.run('UPDATE student SET name = ? WHERE id = ?', ['Ghost', 999]);
    expect(result.changes).toBe(0);
  });

  test('deletes a row', () => {
    adapter.run('INSERT INTO student (name) VALUES (?)', ['ToDelete']);
    const result = adapter.run('DELETE FROM student WHERE id = ?', [1]);
    expect(result.changes).toBe(1);
    const rows = adapter.getAll('SELECT * FROM student');
    expect(rows.length).toBe(0);
  });
});

describe('InMemoryDatabaseAdapter — getAll', () => {
  beforeEach(() => {
    adapter.execRaw('CREATE TABLE item (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)');
    adapter.run('INSERT INTO item (title) VALUES (?)', ['Alpha']);
    adapter.run('INSERT INTO item (title) VALUES (?)', ['Beta']);
    adapter.run('INSERT INTO item (title) VALUES (?)', ['Gamma']);
  });

  test('returns all rows', () => {
    const rows = adapter.getAll<{ id: number; title: string }>('SELECT * FROM item');
    expect(rows.length).toBe(3);
    expect(rows[0].title).toBe('Alpha');
    expect(rows[2].title).toBe('Gamma');
  });

  test('returns empty array when no matches', () => {
    const rows = adapter.getAll('SELECT * FROM item WHERE title = ?', ['Nonexistent']);
    expect(rows).toEqual([]);
  });

  test('supports parameterized queries', () => {
    const rows = adapter.getAll<{ title: string }>('SELECT * FROM item WHERE title = ?', ['Beta']);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Beta');
  });
});

describe('InMemoryDatabaseAdapter — getFirst', () => {
  beforeEach(() => {
    adapter.execRaw('CREATE TABLE config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)');
    adapter.run('INSERT INTO config (key, value) VALUES (?, ?)', ['theme', 'dark']);
    adapter.run('INSERT INTO config (key, value) VALUES (?, ?)', ['lang', 'en']);
  });

  test('returns first matching row', () => {
    const row = adapter.getFirst<{ key: string; value: string }>('SELECT * FROM config WHERE key = ?', ['theme']);
    expect(row).not.toBeNull();
    expect(row!.value).toBe('dark');
  });

  test('returns null when no match', () => {
    const row = adapter.getFirst('SELECT * FROM config WHERE key = ?', ['missing']);
    expect(row).toBeNull();
  });
});

describe('InMemoryDatabaseAdapter — transaction', () => {
  beforeEach(() => {
    adapter.execRaw('CREATE TABLE account (id INTEGER PRIMARY KEY, balance INTEGER)');
    adapter.run('INSERT INTO account (balance) VALUES (?)', [100]);
  });

  test('commits on success', () => {
    adapter.transaction(() => {
      adapter.run('UPDATE account SET balance = balance - 30 WHERE id = ?', [1]);
      adapter.run('INSERT INTO account (balance) VALUES (?)', [30]);
    });
    const rows = adapter.getAll<{ balance: number }>('SELECT * FROM account ORDER BY id');
    expect(rows.length).toBe(2);
    expect(rows[0].balance).toBe(70);
    expect(rows[1].balance).toBe(30);
  });

  test('rolls back on error', () => {
    expect(() => {
      adapter.transaction(() => {
        adapter.run('UPDATE account SET balance = balance - 50 WHERE id = ?', [1]);
        throw new Error('Simulated failure');
      });
    }).toThrow('Simulated failure');

    // Balance should be unchanged
    const row = adapter.getFirst<{ balance: number }>('SELECT * FROM account WHERE id = ?', [1]);
    expect(row!.balance).toBe(100);
  });
});

describe('InMemoryDatabaseAdapter — CRUD cycle', () => {
  test('full create-read-update-delete cycle', () => {
    adapter.execRaw('CREATE TABLE task (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, done INTEGER DEFAULT 0)');

    // Create
    const { lastInsertRowId: id } = adapter.run('INSERT INTO task (title) VALUES (?)', ['Write tests']);
    expect(id).toBe(1);

    // Read
    const task = adapter.getFirst<{ id: number; title: string; done: number }>('SELECT * FROM task WHERE id = ?', [id]);
    expect(task!.title).toBe('Write tests');
    expect(task!.done).toBe(0);

    // Update
    adapter.run('UPDATE task SET done = 1 WHERE id = ?', [id]);
    const updated = adapter.getFirst<{ done: number }>('SELECT * FROM task WHERE id = ?', [id]);
    expect(updated!.done).toBe(1);

    // Delete
    adapter.run('DELETE FROM task WHERE id = ?', [id]);
    const deleted = adapter.getFirst('SELECT * FROM task WHERE id = ?', [id]);
    expect(deleted).toBeNull();
  });
});
