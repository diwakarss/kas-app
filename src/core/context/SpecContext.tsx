/**
 * Spec Context
 *
 * Provides spec, database, and CRUD service to the component tree.
 * This file contains ONLY the context definition - no engine logic.
 *
 * Architecture: Engine initialization is handled by spec-initializer.ts
 * in the engines/ folder. This keeps core/ free of engine dependencies.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import type { KASAppSpec } from '../types/spec';
import type { DatabaseAdapter } from '../../data/database-adapter';
import type { CrudService } from '../../data/crud-service';

export interface SpecContextValue {
  spec: KASAppSpec | null;
  db: DatabaseAdapter | null;
  crud: CrudService | null;
  loading: boolean;
  error: string | null;
}

export const SpecContext = createContext<SpecContextValue>({
  spec: null,
  db: null,
  crud: null,
  loading: true,
  error: null,
});

export function useSpec(): SpecContextValue {
  return useContext(SpecContext);
}

// ──────────────────────────────────────────
// SpecProvider — platform-aware wrapper
// ──────────────────────────────────────────

interface SpecProviderProps {
  children: ReactNode;
}

/**
 * Platform-aware SpecProvider.
 * Delegates to NativeSpecProvider or WebSpecProvider based on platform.
 */
export function SpecProvider({ children }: SpecProviderProps) {
  if (Platform.OS === 'web') {
    const { WebSpecProvider } = require('./WebSpecProvider');
    return <WebSpecProvider>{children}</WebSpecProvider>;
  } else {
    const { NativeSpecProvider } = require('./NativeSpecProvider');
    return <NativeSpecProvider>{children}</NativeSpecProvider>;
  }
}
