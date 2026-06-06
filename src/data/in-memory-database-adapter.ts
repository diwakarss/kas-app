/* sql.js (WASM) is loaded dynamically at runtime — only on web. */
// Avoid top-level import so native bundlers (Android/iOS) don't include Node-only modules.

type SqlJsDatabase = any;
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
  // Only load sql.js on web to avoid referencing Node built-ins on native platforms
  if (typeof document === 'undefined') {
    throw new Error('InMemoryDatabaseAdapter is only available on web platform');
  }
  const sqljsModule = await import('sql.js');
  // initSqlJs is the default export in many builds, fallback to module itself
  const initSqlJs = (sqljsModule && (sqljsModule.default ?? sqljsModule)) as any;
  const SQL = await initSqlJs({
    // Expo Web's bundler can't serve the .wasm file from node_modules.
    // Load it from CDN instead (matches installed sql.js version).
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
  });
  const db = new SQL.Database();
  return new InMemoryDatabaseAdapter(db);
}
