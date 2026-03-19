import React, { useState, useEffect, ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { ExpoDatabaseAdapter } from '../../data/expo-database-adapter';
import { initializeSpec, SpecContextValue, SpecContext } from './SpecContext';

interface NativeSpecProviderProps {
  children: ReactNode;
}

/**
 * Native platform SpecProvider.
 * Uses expo-sqlite via useSQLiteContext() hook.
 */
export function NativeSpecProvider({ children }: NativeSpecProviderProps) {
  const [state, setState] = useState<SpecContextValue>({
    spec: null,
    db: null,
    crud: null,
    loading: true,
    error: null,
  });
  const sqliteDb = useSQLiteContext();

  useEffect(() => {
    try {
      const adapter = new ExpoDatabaseAdapter(sqliteDb);
      const result = initializeSpec(adapter);
      setState(result);
    } catch (err: any) {
      console.log('[NativeSpecProvider] FATAL ERROR:', err.message);
      setState({ spec: null, db: null, crud: null, loading: false, error: err.message ?? 'Failed to initialize' });
    }
  }, [sqliteDb]);

  return (
    <SpecContext.Provider value={state}>
      {children}
    </SpecContext.Provider>
  );
}
