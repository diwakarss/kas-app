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

// InsForge backend API URL - configurable via env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7130';

interface WebSpecProviderProps {
  children: ReactNode;
}

interface PreviewApiResponse {
  success: boolean;
  data?: {
    spec: KASAppSpec;
    sampleRecords?: Record<string, any[]>;
  };
  error?: string;
}

/**
 * Generate sample records client-side from a spec's entity definitions.
 * Mirrors the server-side generateSampleData() in preview.ts.
 */
function generateSampleRecords(spec: KASAppSpec): Record<string, any[]> {
  const records: Record<string, any[]> = {};
  if (!spec?.entities || !Array.isArray(spec.entities)) return records;

  const sampleNames: Record<string, string[]> = {
    client: ['Ramesh Rao', 'Sunita Menon', 'Arun Pillai'],
    customer: ['Anjali Verma', 'Suresh Reddy', 'Meera Nair'],
    student: ['Rahul Sharma', 'Priya Patel', 'Amit Kumar'],
  };

  for (const entity of spec.entities) {
    const entityRecords: any[] = [];
    const count = 3;
    const nameList = sampleNames[entity.name.toLowerCase()] || [`Sample ${entity.display_name} 1`, `Sample ${entity.display_name} 2`, `Sample ${entity.display_name} 3`];

    for (let i = 0; i < count; i++) {
      const rec: any = {
        id: i + 1,
        _created_at: new Date(Date.now() - i * 86400000 * 3).toISOString(),
        _updated_at: new Date().toISOString(),
      };

      for (const field of entity.fields || []) {
        const fn = field.name.toLowerCase();
        const ft = (field.type || 'text').toLowerCase();

        if (fn.includes('name')) { rec[field.name] = nameList[i % nameList.length]; continue; }
        if (fn.includes('email')) { rec[field.name] = `sample${i + 1}@example.com`; continue; }
        if (fn.includes('phone')) { rec[field.name] = `+91 98765 4321${i}`; continue; }

        switch (ft) {
          case 'text': case 'string': rec[field.name] = `Sample ${field.display_name || field.name} ${i + 1}`; break;
          case 'number': case 'integer': rec[field.name] = (i + 1) * 10; break;
          case 'currency': case 'money': rec[field.name] = (i + 1) * 1000; break;
          case 'date': rec[field.name] = new Date(Date.now() + i * 86400000 * 3).toISOString().split('T')[0]; break;
          case 'boolean': rec[field.name] = i % 2 === 0; break;
          case 'choice': case 'select': rec[field.name] = field.options?.[i % (field.options?.length || 1)] || 'Option 1'; break;
          case 'duration': rec[field.name] = `${30 + i * 15} min`; break;
          case 'note': rec[field.name] = ['Good progress.', 'Follow up next week.', 'On track.'][i]; break;
          default: rec[field.name] = `Sample ${field.name} ${i + 1}`;
        }
      }
      entityRecords.push(rec);
    }
    records[entity.name] = entityRecords;
  }
  return records;
}

/**
 * Fetch preview data from InsForge backend API
 */
async function fetchPreviewSpec(specId: string): Promise<PreviewApiResponse> {
  const response = await fetch(`${API_BASE_URL}/get-spec?id=${specId}`);
  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText || `HTTP ${response.status}` };
  }
  const json = await response.json();
  if (!json.success || !json.data) {
    return { success: false, error: json.error || 'No data returned' };
  }
  // The get-spec endpoint returns { success, data: { spec, ... } } without sampleRecords.
  // Generate them client-side from the spec.
  const spec = json.data.spec;
  const sampleRecords = generateSampleRecords(spec);
  return { success: true, data: { spec, sampleRecords } };
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
