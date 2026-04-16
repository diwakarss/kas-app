/**
 * Cloud Spec Provider
 *
 * Provides spec context from cloud-loaded spec data.
 * Used when a spec is fetched from the InsForge backend.
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { SpecContext, SpecContextValue } from './SpecContext';
import { createInMemoryAdapter } from '../../data/in-memory-database-adapter';
import { initializeSpecFromJson } from '../../engines/spec-initializer';
import { CloudSpec } from '../../services/cloud-spec-loader';
import type { DatabaseAdapter } from '../../data/database-adapter';

interface CloudSpecProviderProps {
  children: ReactNode;
  cloudSpec: CloudSpec | null;
}

/**
 * Provides spec context from a cloud-loaded spec.
 * Initializes in-memory database with the spec schema.
 */
export function CloudSpecProvider({ children, cloudSpec }: CloudSpecProviderProps) {
  const [state, setState] = useState<SpecContextValue>({
    spec: null,
    db: null,
    crud: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!cloudSpec) {
      setState({
        spec: null,
        db: null,
        crud: null,
        loading: false,
        error: null,
      });
      return;
    }

    const initializeFromCloud = async () => {
      try {
        console.log('[CloudSpecProvider] Initializing from cloud spec:', cloudSpec.name);

        // Create in-memory adapter for web, or use expo-sqlite for native
        let adapter: DatabaseAdapter;

        if (Platform.OS === 'web') {
          adapter = await createInMemoryAdapter();
        } else {
          // Native: use expo-sqlite
          // For now, use in-memory adapter on native too
          // TODO: Implement persistent SQLite adapter with caching
          adapter = await createInMemoryAdapter();
        }

        // Initialize with the cloud spec
        const result = initializeSpecFromJson(adapter, cloudSpec.spec);

        if (result.error) {
          setState({
            spec: null,
            db: null,
            crud: null,
            loading: false,
            error: result.error,
          });
          return;
        }

        setState(result);
        console.log('[CloudSpecProvider] Spec initialized successfully');
      } catch (error: any) {
        console.error('[CloudSpecProvider] Initialization error:', error);
        setState({
          spec: null,
          db: null,
          crud: null,
          loading: false,
          error: error.message || 'Failed to initialize spec',
        });
      }
    };

    initializeFromCloud();
  }, [cloudSpec?.id, cloudSpec?.version]);

  return (
    <SpecContext.Provider value={state}>
      {children}
    </SpecContext.Provider>
  );
}
