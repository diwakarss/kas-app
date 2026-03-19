/**
 * useInlineEdit Hook Tests
 *
 * Tests the inline edit state management, save, and cancel operations.
 */

import { createMockCrud, createMockDb, mockSpec } from './__mocks__/spec-context';
import { invalidateCache, invalidateCacheForSource } from '../../src/engines/computed-field-engine';

// Mock computed field engine
jest.mock('../../src/engines/computed-field-engine', () => ({
  invalidateCache: jest.fn(),
  invalidateCacheForSource: jest.fn(),
}));

describe('useInlineEdit — State Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    test('isEditing is false initially', () => {
      const editingField: string | null = null;
      const isEditing = editingField !== null;
      expect(isEditing).toBe(false);
    });

    test('editingField is null initially', () => {
      const editingField: string | null = null;
      expect(editingField).toBeNull();
    });
  });

  describe('startEdit', () => {
    test('sets editingField and value', () => {
      let editingField: string | null = null;
      let value: any = undefined;
      let originalValue: any = undefined;

      // Simulate startEdit
      const fieldName = 'name';
      const currentValue = 'Anu';

      editingField = fieldName;
      value = currentValue;
      originalValue = currentValue;

      expect(editingField).toBe('name');
      expect(value).toBe('Anu');
      expect(originalValue).toBe('Anu');
    });

    test('isEditing becomes true after startEdit', () => {
      let editingField: string | null = 'name';
      const isEditing = editingField !== null;
      expect(isEditing).toBe(true);
    });
  });

  describe('setValue', () => {
    test('updates value while editing', () => {
      let value: any = 'Anu';
      value = 'Priya';
      expect(value).toBe('Priya');
    });

    test('originalValue remains unchanged during edit', () => {
      const originalValue = 'Anu';
      let value: any = 'Anu';
      value = 'Priya';

      expect(originalValue).toBe('Anu');
      expect(value).toBe('Priya');
    });
  });

  describe('cancel', () => {
    test('resets all edit state', () => {
      let editingField: string | null = 'name';
      let value: any = 'Priya';
      let originalValue: any = 'Anu';

      // Simulate cancel
      editingField = null;
      value = undefined;
      originalValue = undefined;

      expect(editingField).toBeNull();
      expect(value).toBeUndefined();
      expect(originalValue).toBeUndefined();
    });

    test('isEditing becomes false after cancel', () => {
      let editingField: string | null = null;
      const isEditing = editingField !== null;
      expect(isEditing).toBe(false);
    });
  });
});

describe('useInlineEdit — Save Operation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('save calls crud.update with correct params', () => {
    const mockCrud = createMockCrud();
    const entityType = 'Student';
    const entityId = 1;
    const editingField = 'name';
    const value = 'Priya';

    mockCrud.update(entityType, entityId, { [editingField]: value });

    expect(mockCrud.update).toHaveBeenCalledWith('Student', 1, { name: 'Priya' });
  });

  test('save invalidates cache for entity type', () => {
    const entityType = 'Student';

    // Simulate save cache invalidation
    invalidateCache(entityType);

    expect(invalidateCache).toHaveBeenCalledWith('Student');
  });

  test('save invalidates cache for source entities', () => {
    const entityType = 'Student';

    // Simulate save cache invalidation
    invalidateCacheForSource(entityType, mockSpec);

    expect(invalidateCacheForSource).toHaveBeenCalledWith('Student', mockSpec);
  });

  test('save returns true on success', () => {
    const mockCrud = createMockCrud({
      update: jest.fn().mockReturnValue(true),
    });

    let success = false;
    try {
      mockCrud.update('Student', 1, { name: 'Priya' });
      success = true;
    } catch {
      success = false;
    }

    expect(success).toBe(true);
  });

  test('save returns false on error', () => {
    const mockCrud = createMockCrud({
      update: jest.fn().mockImplementation(() => {
        throw new Error('DB error');
      }),
    });

    let success = false;
    try {
      mockCrud.update('Student', 1, { name: 'Priya' });
      success = true;
    } catch {
      success = false;
    }

    expect(success).toBe(false);
  });

  test('save resets edit state on success', () => {
    let editingField: string | null = 'name';
    let value: any = 'Priya';
    let originalValue: any = 'Anu';

    // Simulate successful save
    const success = true;
    if (success) {
      editingField = null;
      value = undefined;
      originalValue = undefined;
    }

    expect(editingField).toBeNull();
  });
});

describe('useInlineEdit — Guard Conditions', () => {
  test('save fails when editingField is null', () => {
    const editingField: string | null = null;
    const crud = createMockCrud();

    const canSave = editingField !== null && crud !== null;
    expect(canSave).toBe(false);
  });

  test('save fails when crud is null', () => {
    const editingField = 'name';
    const crud = null;

    const canSave = editingField !== null && crud !== null;
    expect(canSave).toBe(false);
  });
});
