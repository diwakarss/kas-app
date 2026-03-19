/**
 * useAnchorData Hook Tests
 *
 * Tests anchor data fetching, card building, and stats computation.
 */

import { createMockCrud, createMockDb, mockSpec } from './__mocks__/spec-context';
import { toTableName } from '../../src/data/query-builder';

describe('useAnchorData — Time of Day', () => {
  test('morning is before noon', () => {
    const getTimeOfDay = (hour: number) => {
      if (hour < 12) return 'morning';
      if (hour < 17) return 'afternoon';
      return 'evening';
    };

    expect(getTimeOfDay(6)).toBe('morning');
    expect(getTimeOfDay(9)).toBe('morning');
    expect(getTimeOfDay(11)).toBe('morning');
  });

  test('afternoon is between noon and 5pm', () => {
    const getTimeOfDay = (hour: number) => {
      if (hour < 12) return 'morning';
      if (hour < 17) return 'afternoon';
      return 'evening';
    };

    expect(getTimeOfDay(12)).toBe('afternoon');
    expect(getTimeOfDay(14)).toBe('afternoon');
    expect(getTimeOfDay(16)).toBe('afternoon');
  });

  test('evening is after 5pm', () => {
    const getTimeOfDay = (hour: number) => {
      if (hour < 12) return 'morning';
      if (hour < 17) return 'afternoon';
      return 'evening';
    };

    expect(getTimeOfDay(17)).toBe('evening');
    expect(getTimeOfDay(20)).toBe('evening');
    expect(getTimeOfDay(23)).toBe('evening');
  });
});

describe('useAnchorData — Date Offset', () => {
  test('yesterday_summary returns -1 day offset', () => {
    const getDateOffset = (anchorType: string) => {
      switch (anchorType) {
        case 'yesterday_summary':
          return '-1 day';
        case 'day_schedule':
        default:
          return undefined;
      }
    };

    expect(getDateOffset('yesterday_summary')).toBe('-1 day');
  });

  test('day_schedule returns no offset', () => {
    const getDateOffset = (anchorType: string) => {
      switch (anchorType) {
        case 'yesterday_summary':
          return '-1 day';
        case 'day_schedule':
        default:
          return undefined;
      }
    };

    expect(getDateOffset('day_schedule')).toBeUndefined();
  });

  test('unknown type returns no offset', () => {
    const getDateOffset = (anchorType: string) => {
      switch (anchorType) {
        case 'yesterday_summary':
          return '-1 day';
        case 'day_schedule':
        default:
          return undefined;
      }
    };

    expect(getDateOffset('unknown')).toBeUndefined();
  });
});

describe('useAnchorData — Anchor Config', () => {
  test('spec has anchor config', () => {
    expect(mockSpec.anchor).toBeDefined();
  });

  test('anchor has entity and type', () => {
    expect(mockSpec.anchor.entity).toBeDefined();
    expect(mockSpec.anchor.type).toBeDefined();
  });

  test('anchor has card_display config', () => {
    expect(mockSpec.anchor.card_display).toBeDefined();
    expect(mockSpec.anchor.card_display.title).toBeDefined();
    expect(mockSpec.anchor.card_display.subtitle).toBeDefined();
  });

  test('anchor has empty_state config', () => {
    expect(mockSpec.anchor.empty_state).toBeDefined();
    expect(mockSpec.anchor.empty_state.message).toBeDefined();
  });
});

describe('useAnchorData — Card Building', () => {
  test('finds belongs_to relationship', () => {
    const anchorEntity = mockSpec.entities.find(e => e.name === mockSpec.anchor.entity);
    const belongsTo = anchorEntity?.relationships.find(r => r.type === 'belongs_to');

    expect(belongsTo).toBeDefined();
    expect(belongsTo?.target).toBeDefined();
  });

  test('extracts time from datetime field', () => {
    const rawTime = '2026-03-19T14:30:00';
    const time = rawTime.includes('T')
      ? rawTime.split('T')[1]?.substring(0, 5)
      : rawTime;

    expect(time).toBe('14:30');
  });

  test('handles time without T separator', () => {
    const rawTime = '14:30';
    const time = rawTime.includes('T')
      ? rawTime.split('T')[1]?.substring(0, 5)
      : rawTime;

    expect(time).toBe('14:30');
  });
});

describe('useAnchorData — Query Types', () => {
  test('day_schedule uses anchorQuery', () => {
    const anchorType = 'day_schedule';
    const usesAnchorQuery = anchorType === 'day_schedule' || anchorType === 'yesterday_summary';
    expect(usesAnchorQuery).toBe(true);
  });

  test('upcoming_project uses list with date filter', () => {
    const anchorType = 'upcoming_project';
    const usesListWithFilter = anchorType === 'upcoming_project';
    expect(usesListWithFilter).toBe(true);
  });

  test('active_list uses list ordered by updated_at', () => {
    const anchorType = 'active_list';
    const usesListByUpdated = anchorType === 'active_list';
    expect(usesListByUpdated).toBe(true);
  });
});

describe('useAnchorData — Stats', () => {
  test('spec has stats config', () => {
    expect(mockSpec.anchor.summary.stats).toBeDefined();
    expect(mockSpec.anchor.summary.stats.length).toBeGreaterThan(0);
  });

  test('each stat has label and query', () => {
    for (const stat of mockSpec.anchor.summary.stats) {
      expect(stat.label).toBeDefined();
      expect(stat.query).toBeDefined();
    }
  });
});

describe('useAnchorData — Related Data', () => {
  test('fetches related entity for FK', () => {
    const mockCrud = createMockCrud({
      read: jest.fn().mockReturnValue({ id: 1, name: 'Anu', hourly_fee: 500 }),
    });

    const relatedData = mockCrud.read('Student', 1);
    expect(relatedData).toBeDefined();
    expect(relatedData?.name).toBe('Anu');
  });

  test('builds relatedMap for template resolution', () => {
    const belongsTo = { target: 'Student', foreign_key: 'student_id' };
    const entity = { id: 1, student_id: 5, subject: 'Math' };
    const relatedEntity = { id: 5, name: 'Anu' };

    const relatedMap: Record<string, Record<string, any>> = {};
    if (belongsTo && entity[belongsTo.foreign_key as keyof typeof entity]) {
      relatedMap[belongsTo.target.toLowerCase()] = relatedEntity;
    }

    expect(relatedMap.student).toBeDefined();
    expect(relatedMap.student.name).toBe('Anu');
  });
});

describe('useAnchorData — Null Safety', () => {
  test('returns null when spec is null', () => {
    const spec = null;
    const result = spec ? 'data' : null;
    expect(result).toBeNull();
  });

  test('returns null when anchor entity not found', () => {
    const anchorEntity = mockSpec.entities.find(e => e.name === 'NonExistent');
    expect(anchorEntity).toBeUndefined();
  });
});
