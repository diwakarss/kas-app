import React, { useState, useEffect, ReactNode } from 'react';
import { createInMemoryAdapter } from '../../data/in-memory-database-adapter';
import { initializeSpec, SpecContextValue, SpecContext } from './SpecContext';

interface WebSpecProviderProps {
  children: ReactNode;
}

/**
 * Web platform SpecProvider.
 * Uses sql.js (WebAssembly) in-memory adapter — no expo-sqlite dependency.
 * Data lives in memory only; not persisted across reloads.
 */
export function WebSpecProvider({ children }: WebSpecProviderProps) {
  const [state, setState] = useState<SpecContextValue>({
    spec: null,
    db: null,
    crud: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        console.log('[WebSpecProvider] Initializing sql.js adapter...');
        const adapter = await createInMemoryAdapter();
        console.log('[WebSpecProvider] sql.js adapter ready');
        const result = initializeSpec(adapter);
        setState(result);
      } catch (err: any) {
        console.log('[WebSpecProvider] FATAL ERROR:', err.message);
        setState({ spec: null, db: null, crud: null, loading: false, error: err.message ?? 'Failed to initialize' });
      }
    })();
  }, []);

  return (
    <SpecContext.Provider value={state}>
      {children}
    </SpecContext.Provider>
  );
}
