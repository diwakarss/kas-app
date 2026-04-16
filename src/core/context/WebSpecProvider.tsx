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
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7133';

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
/** Contextual sample values for common text field names */
const SAMPLE_TEXT: Record<string, string[]> = {
  description: ['Regular checkup and cleaning', 'Follow-up consultation', 'New patient intake'],
  reason: ['Annual wellness exam', 'Persistent cough', 'Post-surgery follow-up'],
  topic: ['Algebra fundamentals', 'Essay writing', 'Science project'],
  activity: ['Arts and crafts', 'Story time', 'Outdoor play'],
  style: ['Ballet', 'Contemporary', 'Hip Hop'],
  service: ['Full grooming package', 'Nail trim only', 'Bath and brush'],
  notes: ['Good progress overall', 'Follow up next week', 'On track with plan'],
  note: ['Good progress overall', 'Follow up next week', 'On track with plan'],
  address: ['123 MG Road, Bangalore', '45 Anna Nagar, Chennai', '78 Park Street, Kolkata'],
  location: ['Main Studio', 'Conference Room A', 'Outdoor Area'],
  title: ['Introduction Session', 'Advanced Workshop', 'Review Meeting'],
};

function generateSampleRecords(spec: KASAppSpec): Record<string, any[]> {
  const records: Record<string, any[]> = {};
  if (!spec?.entities || !Array.isArray(spec.entities)) return records;

  const sampleNames: Record<string, string[]> = {
    client: ['Ramesh Rao', 'Sunita Menon', 'Arun Pillai'],
    customer: ['Anjali Verma', 'Suresh Reddy', 'Meera Nair'],
    student: ['Rahul Sharma', 'Priya Patel', 'Amit Kumar'],
    child: ['Aarav Mehta', 'Ishita Roy', 'Kabir Singh'],
    kid: ['Aarav Mehta', 'Ishita Roy', 'Kabir Singh'],
    pet: ['Buddy', 'Luna', 'Max'],
    dog: ['Buddy', 'Luna', 'Max'],
    cat: ['Whiskers', 'Mittens', 'Shadow'],
    animal: ['Buddy', 'Luna', 'Max'],
    vehicle: ['2022 Honda Civic', '2021 Toyota Camry', '2020 Ford F-150'],
    car: ['2022 Honda Civic', '2021 Toyota Camry', '2020 Ford F-150'],
    instructor: ['Vikram Das', 'Lakshmi Iyer', 'Deepa Shah'],
    teacher: ['Vikram Das', 'Lakshmi Iyer', 'Deepa Shah'],
    employee: ['Ravi Patel', 'Neha Gupta', 'Sanjay Mishra'],
    staff: ['Ravi Patel', 'Neha Gupta', 'Sanjay Mishra'],
    class: ['Ballet Basics', 'Contemporary Dance', 'Hip Hop Beginners'],
    course: ['Intro to Music', 'Advanced Art', 'Creative Writing'],
    room: ['Room 101', 'Studio A', 'Conference Hall'],
    product: ['Premium Widget', 'Standard Kit', 'Deluxe Package'],
    item: ['Item A', 'Item B', 'Item C'],
    member: ['Arjun Nair', 'Kavitha Reddy', 'Mohan Das'],
    patient: ['Suresh Babu', 'Radha Krishnan', 'Anita Desai'],
    appointment: ['Consultation', 'Follow-up', 'Check-up'],
    session: ['Morning Session', 'Afternoon Session', 'Evening Session'],
    payment: ['Monthly Payment', 'Registration Fee', 'Material Fee'],
    invoice: ['INV-001', 'INV-002', 'INV-003'],
    order: ['Order #1001', 'Order #1002', 'Order #1003'],
    part: ['Brake Pad Set', 'Oil Filter', 'Spark Plug Kit'],
  };

  for (const entity of spec.entities) {
    const entityRecords: any[] = [];
    const count = 3;
    const nameList = sampleNames[entity.name.toLowerCase()] || [`Sample ${entity.display_name} 1`, `Sample ${entity.display_name} 2`, `Sample ${entity.display_name} 3`];

    for (let i = 0; i < count; i++) {
      const rec: any = {};

      for (const field of entity.fields || []) {
        const fn = field.name.toLowerCase();
        const ft = (field.type || 'text').toLowerCase();

        if (fn.includes('name')) { rec[field.name] = nameList[i % nameList.length]; continue; }
        if (fn.includes('email')) { rec[field.name] = `sample${i + 1}@example.com`; continue; }
        if (fn.includes('phone')) { rec[field.name] = `+91 98765 4321${i}`; continue; }

        // FK fields: reference record i+1 in the target entity (autoincrement IDs start at 1)
        // Match on field name suffix regardless of declared type — LLM sometimes types these as 'integer' or leaves blank.
        if (fn.endsWith('_id')) {
          rec[field.name] = (i % count) + 1;
          continue;
        }

        switch (ft) {
          case 'text': case 'string': {
            const contextual = SAMPLE_TEXT[fn];
            rec[field.name] = contextual ? contextual[i % contextual.length] : `Sample ${field.display_name || field.name} ${i + 1}`;
            break;
          }
          case 'number': case 'integer': rec[field.name] = (i + 1) * 10; break;
          case 'currency': case 'money': rec[field.name] = (i + 1) * 1000; break;
          case 'date': {
            // First record = today, spread others around today
            const offset = i === 0 ? 0 : i * 3;
            rec[field.name] = new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
            break;
          }
          case 'datetime': {
            // First record = today, spread around today with different times
            const dtOffset = i === 0 ? 0 : i * 3;
            const hours = 9 + i * 2; // 9am, 11am, 1pm
            const dt = new Date(Date.now() + dtOffset * 86400000);
            dt.setHours(hours, 0, 0, 0);
            rec[field.name] = dt.toISOString();
            break;
          }
          case 'time': {
            const h = 9 + i * 2;
            rec[field.name] = `${String(h).padStart(2, '0')}:00`;
            break;
          }
          case 'boolean': case 'toggle': rec[field.name] = i % 2 === 0; break;
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
 * Topologically sort entities so parents come before children.
 * Entities with no belongs_to come first; cycles break in declaration order.
 */
function topoSortEntities(spec: KASAppSpec, available: string[]): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const byName = new Map((spec.entities || []).map(e => [e.name, e]));
  const availSet = new Set(available);

  function visit(name: string, stack: Set<string>) {
    if (visited.has(name) || !availSet.has(name) || stack.has(name)) return;
    stack.add(name);
    const ent = byName.get(name);
    const parents = (ent?.relationships || [])
      .filter(r => r.type === 'belongs_to')
      .map(r => r.target);
    for (const p of parents) visit(p, stack);
    stack.delete(name);
    if (!visited.has(name)) {
      visited.add(name);
      order.push(name);
    }
  }

  for (const name of available) visit(name, new Set());
  return order;
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

          // Insert sample records if provided — parents before children so FK references resolve.
          if (response.data.sampleRecords && result.crud) {
            console.log('[WebSpecProvider] Inserting sample records...');
            const insertOrder = topoSortEntities(response.data.spec, Object.keys(response.data.sampleRecords));
            for (const entityName of insertOrder) {
              const records = response.data.sampleRecords[entityName];
              if (!records) continue;
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
