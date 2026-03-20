/**
 * useSearch Hook for KAS App JSON Renderer.
 *
 * Debounced FTS5 search across all searchable entities,
 * grouped by entity type with resolved display templates.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSpec } from '../core/context/SpecContext';
import { resolveTemplate } from '../engines/template-engine';
import { toTableName } from '../data/query-builder';

export interface SearchResult {
  id: number;
  entityType: string;
  display: string;
}

export interface SearchGroup {
  entityType: string;
  displayName: string;
  icon: string;
  results: SearchResult[];
}

export interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  groups: SearchGroup[];
  isEmpty: boolean;
  isSearching: boolean;
  clear: () => void;
}

const DEBOUNCE_MS = 300;

export function useSearch(): SearchState {
  const { spec, crud } = useSpec();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const groups = useMemo(() => {
    if (!spec || !crud || !debouncedQuery) return [];

    const searchConfig = spec.search;
    if (!searchConfig) return [];

    const result: SearchGroup[] = [];

    for (const entityName of searchConfig.entities) {
      const entityDef = spec.entities.find(e => e.name === entityName);
      if (!entityDef) continue;

      const belongsTo = entityDef.relationships.find(r => r.type === 'belongs_to');
      const joinTarget = belongsTo ? toTableName(belongsTo.target) : undefined;
      const joinFK = belongsTo?.foreign_key;

      const rawResults = crud.search(entityName, debouncedQuery, 20, joinTarget, joinFK);

      if (rawResults.length === 0) continue;

      const displayTemplate = searchConfig.display?.[entityName] || '{name}';

      const results: SearchResult[] = rawResults.map(row => {
        const relatedMap: Record<string, Record<string, any>> = {};
        if (belongsTo && row._related_name) {
          relatedMap[belongsTo.target.toLowerCase()] = { name: row._related_name };
        }

        return {
          id: row.id,
          entityType: entityName,
          display: resolveTemplate(displayTemplate, row, relatedMap),
        };
      });

      result.push({
        entityType: entityName,
        displayName: entityDef.display_name_plural,
        icon: entityDef.icon,
        results,
      });
    }

    return result;
  }, [spec, crud, debouncedQuery]);

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  const isSearching = query.trim() !== '' && query.trim() !== debouncedQuery;

  return {
    query,
    setQuery,
    groups,
    isEmpty: debouncedQuery !== '' && groups.length === 0,
    isSearching,
    clear,
  };
}
