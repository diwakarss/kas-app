/**
 * Web Spec Provider
 *
 * Uses sql.js (WebAssembly) for in-memory database on web platform.
 * Supports preview mode: loads spec from API when ?spec_id=xxx is in URL.
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { createInMemoryAdapter } from '../../data/in-memory-database-adapter';
import { initializeSpec, initializeSpecFromJson } from '../../engines/spec-initializer';
import { SpecContextValue, SpecContext } from './SpecContext';
import { usePreview } from './PreviewContext';
import type { KASAppSpec } from '../types/spec';

// Backend API base URL - configurable via env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7131';

interface WebSpecProviderProps {
  children: ReactNode;
}

interface PreviewApiResponse {
  success: boolean;
  data?: {
    spec: KASAppSpec;
    sampleRecords: Record<string, any[]>;
  };
  error?: string;
}

/**
 * Fetch preview data from backend API
 */
async function fetchPreviewSpec(specId: string): Promise<PreviewApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/preview/${specId}`);
  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText || `HTTP ${response.status}` };
  }
  return response.json();
}

/**
 * Web platform SpecProvider.
 * Uses sql.js (WebAssembly) in-memory adapter — no expo-sqlite dependency.
 *
 * Preview mode: When ?spec_id=xxx is in URL, fetches spec from backend API
 * and populates with sample data.
 *
 * Normal mode: Loads local spec from config.
 */
export function WebSpecProvider({ children }: WebSpecProviderProps) {
  const preview = usePreview();
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

        // Preview mode: fetch spec from API
        if (preview.isPreviewMode && preview.specId) {
          console.log(`[WebSpecProvider] Preview mode: fetching spec ${preview.specId}`);
          const response = await fetchPreviewSpec(preview.specId);

          if (!response.success || !response.data) {
            const errorMsg = response.error || 'Failed to load preview';
            console.error('[WebSpecProvider] Preview fetch failed:', errorMsg);
            preview.setPreviewError(errorMsg);
            setState({
              spec: null,
              db: null,
              crud: null,
              loading: false,
              error: errorMsg,
            });
            return;
          }

          // Initialize with fetched spec
          const result = initializeSpecFromJson(adapter, response.data.spec);

          // Insert sample records if provided
          if (response.data.sampleRecords && result.crud) {
            console.log('[WebSpecProvider] Inserting sample records...');
            for (const [entityName, records] of Object.entries(response.data.sampleRecords)) {
              for (const record of records) {
                try {
                  await result.crud.create(entityName, record);
                } catch (e) {
                  console.warn(`[WebSpecProvider] Failed to insert sample ${entityName}:`, e);
                }
              }
            }
            console.log('[WebSpecProvider] Sample records inserted');
          }

          preview.setPreviewReady();
          setState(result);
          return;
        }

        // Normal mode: load local spec
        const result = initializeSpec(adapter);
        setState(result);
      } catch (err: any) {
        console.error('[WebSpecProvider] FATAL ERROR:', err.message);
        if (preview.isPreviewMode) {
          preview.setPreviewError(err.message);
        }
        setState({
          spec: null,
          db: null,
          crud: null,
          loading: false,
          error: err.message ?? 'Failed to initialize',
        });
      }
    })();
  }, [preview.specId]);

  return (
    <SpecContext.Provider value={state}>
      {children}
    </SpecContext.Provider>
  );
}
