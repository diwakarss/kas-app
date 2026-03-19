import type { SQLiteDatabase } from 'expo-sqlite';
import type { DatabaseAdapter } from './database-adapter';

/**
 * DatabaseAdapter implementation wrapping expo-sqlite.
 * Used on native platforms (iOS/Android).
 * Web platform will use InMemoryDatabaseAdapter (Phase C).
 */
export class ExpoDatabaseAdapter implements DatabaseAdapter {
  constructor(private db: SQLiteDatabase) {}

  execRaw(sql: string): void {
    // Use the synchronous SQL execution method from expo-sqlite
    this.db.execSync(sql);
  }

  run(sql: string, params?: any[]): { changes: number; lastInsertRowId: number } {
    const result = this.db.runSync(sql, params ?? []);
    return {
      changes: result.changes,
      lastInsertRowId: result.lastInsertRowId,
    };
  }

  getAll<T = Record<string, any>>(sql: string, params?: any[]): T[] {
    return this.db.getAllSync(sql, params ?? []) as T[];
  }

  getFirst<T = Record<string, any>>(sql: string, params?: any[]): T | null {
    return (this.db.getFirstSync(sql, params ?? []) as T) ?? null;
  }

  transaction(fn: () => void): void {
    this.db.withTransactionSync(fn);
  }
}
