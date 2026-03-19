/**
 * useInlineEdit Hook for KAS App JSON Renderer.
 *
 * Manages inline edit state for a single field at a time.
 * Calls crud.update on save, reverts on cancel.
 */

import { useState, useCallback } from 'react';
import { useSpec } from '../core/context/SpecContext';
import { invalidateCache, invalidateCacheForSource } from '../engines/computed-field-engine';

export interface InlineEditState {
  isEditing: boolean;
  editingField: string | null;
  value: any;
  originalValue: any;
  startEdit: (fieldName: string, currentValue: any) => void;
  setValue: (value: any) => void;
  save: () => boolean;
  cancel: () => void;
}

export function useInlineEdit(entityType: string, entityId: number): InlineEditState {
  const { spec, crud } = useSpec();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [value, setValue] = useState<any>(undefined);
  const [originalValue, setOriginalValue] = useState<any>(undefined);

  const startEdit = useCallback((fieldName: string, currentValue: any) => {
    setEditingField(fieldName);
    setValue(currentValue);
    setOriginalValue(currentValue);
  }, []);

  const save = useCallback((): boolean => {
    if (!editingField || !crud || !spec) return false;
    try {
      crud.update(entityType, entityId, { [editingField]: value });
      invalidateCache(entityType);
      invalidateCacheForSource(entityType, spec);
      setEditingField(null);
      setValue(undefined);
      setOriginalValue(undefined);
      return true;
    } catch {
      return false;
    }
  }, [editingField, value, crud, spec, entityType, entityId]);

  const cancel = useCallback(() => {
    setEditingField(null);
    setValue(undefined);
    setOriginalValue(undefined);
  }, []);

  return {
    isEditing: editingField !== null,
    editingField,
    value,
    originalValue,
    startEdit,
    setValue,
    save,
    cancel,
  };
}
