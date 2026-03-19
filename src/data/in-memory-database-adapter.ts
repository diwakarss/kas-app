import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { DatabaseAdapter, RunResult } from './database-adapter';

/**
 * In-memory SQLite adapter using sql.js (WebAssembly).
 * Used on web platform where expo-sqlite is not available.
 * Data lives in memory only — not persisted across reloads.
 */
export class InMemoryDatabaseAdapter implements DatabaseAdapter {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  execRaw(sql: string): void {
    this.db.run(sql);
  }

  run(sql: string, params?: any[]): RunResult {
    this.db.run(sql, params as any);
    const result = this.db.exec(
      'SELECT last_insert_rowid() as id, changes() as changes'
    );
    const lastId = (result[0]?.values[0]?.[0] as number) ?? 0;
    const changesCount = (result[0]?.values[0]?.[1] as number) ?? 0;
    return { lastInsertRowId: lastId, changes: changesCount };
  }

  getAll<T = Record<string, any>>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params as any);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  getFirst<T = Record<string, any>>(sql: string, params?: any[]): T | null {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params as any);
    }
    let result: T | null = null;
    if (stmt.step()) {
      result = stmt.getAsObject() as T;
    }
    stmt.free();
    return result;
  }

  transaction(fn: () => void): void {
    this.db.run('BEGIN TRANSACTION');
    try {
      fn();
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }
}

/**
 * Factory: create an initialized InMemoryDatabaseAdapter.
 * Loads sql.js WASM binary — must be called once at startup.
 */
export async function createInMemoryAdapter(): Promise<InMemoryDatabaseAdapter> {
  const SQL = await initSqlJs({
    // Expo Web's bundler can't serve the .wasm file from node_modules.
    // Load it from CDN instead (matches installed sql.js version).
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
  });
  const db = new SQL.Database();
  return new InMemoryDatabaseAdapter(db);
}
