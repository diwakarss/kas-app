/**
 * Platform-agnostic database interface for KAS App.
 *
 * Implementations will wrap expo-sqlite (mobile) or better-sqlite3 (tests).
 * Every method is synchronous -- expo-sqlite v16 uses synchronous APIs
 * and SQLite itself is single-threaded, so async adds no value here.
 */

export interface RunResult {
  /** Number of rows affected by the statement. */
  changes: number;
  /** Row ID of the last inserted row. */
  lastInsertRowId: number;
}

export interface DatabaseAdapter {
  /** Execute raw SQL (DDL, PRAGMA) -- no return value. */
  execRaw(sql: string): void;

  /** Run a single parameterized statement. Returns changes count and last insert ID. */
  run(sql: string, params?: any[]): RunResult;

  /** Query multiple rows. */
  getAll<T = Record<string, any>>(sql: string, params?: any[]): T[];

  /** Query a single row (or null if no match). */
  getFirst<T = Record<string, any>>(sql: string, params?: any[]): T | null;

  /** Run a function inside a transaction (all-or-nothing). */
  transaction(fn: () => void): void;
}
