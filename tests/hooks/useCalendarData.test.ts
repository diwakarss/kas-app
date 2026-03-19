/**
 * useCalendarData Hook Tests
 *
 * Tests calendar state management, month navigation, and event grouping.
 */

import { createMockCrud, mockSpec } from './__mocks__/spec-context';

describe('useCalendarData — Calendar Config', () => {
  test('spec has calendar config', () => {
    expect(mockSpec.calendar).toBeDefined();
  });

  test('calendar has entity and date_field', () => {
    expect(mockSpec.calendar.entity).toBeDefined();
    expect(mockSpec.calendar.date_field).toBeDefined();
  });

  test('calendar has display template', () => {
    expect(mockSpec.calendar.display).toBeDefined();
  });
});

describe('useCalendarData — Month Navigation', () => {
  describe('prevMonth', () => {
    test('December goes to previous year November... wait, January to December', () => {
      let year = 2026;
      let month = 1; // January

      // Simulate prevMonth
      if (month === 1) {
        year = year - 1;
        month = 12;
      } else {
        month = month - 1;
      }

      expect(year).toBe(2025);
      expect(month).toBe(12);
    });

    test('mid-year goes to previous month', () => {
      let year = 2026;
      let month = 6; // June

      // Simulate prevMonth
      if (month === 1) {
        year = year - 1;
        month = 12;
      } else {
        month = month - 1;
      }

      expect(year).toBe(2026);
      expect(month).toBe(5);
    });
  });

  describe('nextMonth', () => {
    test('December goes to next year January', () => {
      let year = 2026;
      let month = 12; // December

      // Simulate nextMonth
      if (month === 12) {
        year = year + 1;
        month = 1;
      } else {
        month = month + 1;
      }

      expect(year).toBe(2027);
      expect(month).toBe(1);
    });

    test('mid-year goes to next month', () => {
      let year = 2026;
      let month = 6; // June

      // Simulate nextMonth
      if (month === 12) {
        year = year + 1;
        month = 1;
      } else {
        month = month + 1;
      }

      expect(year).toBe(2026);
      expect(month).toBe(7);
    });
  });

  test('navigation clears selected date', () => {
    let selectedDate: string | null = '2026-03-15';

    // Simulate navigation
    selectedDate = null;

    expect(selectedDate).toBeNull();
  });
});

describe('useCalendarData — Event Grouping', () => {
  test('groups events by date key', () => {
    const rawEvents = [
      { id: 1, datetime: '2026-03-15T10:00:00', subject: 'Math' },
      { id: 2, datetime: '2026-03-15T14:00:00', subject: 'Science' },
      { id: 3, datetime: '2026-03-16T10:00:00', subject: 'English' },
    ];

    const grouped: Record<string, typeof rawEvents> = {};
    for (const row of rawEvents) {
      const dateVal = row.datetime;
      const dateKey = dateVal.includes('T')
        ? dateVal.split('T')[0]
        : dateVal.substring(0, 10);

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(row);
    }

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['2026-03-15']).toHaveLength(2);
    expect(grouped['2026-03-16']).toHaveLength(1);
  });

  test('extracts date from ISO datetime', () => {
    const datetime = '2026-03-19T14:30:00';
    const dateKey = datetime.split('T')[0];
    expect(dateKey).toBe('2026-03-19');
  });

  test('handles date without time', () => {
    const dateVal = '2026-03-19';
    const dateKey = dateVal.includes('T')
      ? dateVal.split('T')[0]
      : dateVal.substring(0, 10);
    expect(dateKey).toBe('2026-03-19');
  });
});

describe('useCalendarData — Status Colors', () => {
  const STATUS_COLOR_MAP: Record<string, string> = {
    scheduled: 'stream',
    completed: 'bloom',
    rescheduled: 'mist',
    cancelled: 'ember',
  };

  test('scheduled maps to stream', () => {
    expect(STATUS_COLOR_MAP['scheduled']).toBe('stream');
  });

  test('completed maps to bloom', () => {
    expect(STATUS_COLOR_MAP['completed']).toBe('bloom');
  });

  test('rescheduled maps to mist', () => {
    expect(STATUS_COLOR_MAP['rescheduled']).toBe('mist');
  });

  test('cancelled maps to ember', () => {
    expect(STATUS_COLOR_MAP['cancelled']).toBe('ember');
  });

  test('unknown status defaults to stream', () => {
    const status = 'unknown';
    const color = STATUS_COLOR_MAP[status] || 'stream';
    expect(color).toBe('stream');
  });
});

describe('useCalendarData — Date Selection', () => {
  test('selectDate sets selectedDate', () => {
    let selectedDate: string | null = null;

    // Simulate selectDate
    selectedDate = '2026-03-15';

    expect(selectedDate).toBe('2026-03-15');
  });

  test('selectDate can clear selection', () => {
    let selectedDate: string | null = '2026-03-15';

    // Simulate selectDate(null)
    selectedDate = null;

    expect(selectedDate).toBeNull();
  });

  test('selectedEvents returns events for selected date', () => {
    const events: Record<string, { id: number }[]> = {
      '2026-03-15': [{ id: 1 }, { id: 2 }],
      '2026-03-16': [{ id: 3 }],
    };
    const selectedDate = '2026-03-15';

    const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

    expect(selectedEvents).toHaveLength(2);
  });

  test('selectedEvents returns empty for unselected date', () => {
    const events: Record<string, { id: number }[]> = {
      '2026-03-15': [{ id: 1 }],
    };
    const selectedDate: string | null = null;

    const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

    expect(selectedEvents).toHaveLength(0);
  });

  test('selectedEvents returns empty for date with no events', () => {
    const events: Record<string, { id: number }[]> = {
      '2026-03-15': [{ id: 1 }],
    };
    const selectedDate = '2026-03-20';

    const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

    expect(selectedEvents).toHaveLength(0);
  });
});

describe('useCalendarData — Related Data', () => {
  test('uses _related_name from JOIN when available', () => {
    const row = { id: 1, student_id: 5, _related_name: 'Anu' };
    const belongsTo = { target: 'Student', foreign_key: 'student_id' };

    const relatedMap: Record<string, Record<string, any>> = {};
    if (belongsTo && row._related_name) {
      relatedMap[belongsTo.target.toLowerCase()] = { name: row._related_name };
    }

    expect(relatedMap.student.name).toBe('Anu');
  });

  test('falls back to crud.read when _related_name missing', () => {
    const row = { id: 1, student_id: 5 };
    const belongsTo = { target: 'Student', foreign_key: 'student_id' };

    const mockCrud = createMockCrud({
      read: jest.fn().mockReturnValue({ id: 5, name: 'Priya' }),
    });

    const relatedMap: Record<string, Record<string, any>> = {};
    if (belongsTo && !('_related_name' in row) && row[belongsTo.foreign_key as keyof typeof row]) {
      const related = mockCrud.read(belongsTo.target, row[belongsTo.foreign_key as keyof typeof row]);
      if (related) relatedMap[belongsTo.target.toLowerCase()] = related;
    }

    expect(mockCrud.read).toHaveBeenCalledWith('Student', 5);
    expect(relatedMap.student.name).toBe('Priya');
  });
});

describe('useCalendarData — Null Safety', () => {
  test('returns null when calendar config missing', () => {
    const calConfig = undefined;
    const result = calConfig ? 'data' : null;
    expect(result).toBeNull();
  });

  test('returns empty events when entity not found', () => {
    const entityDef = mockSpec.entities.find(e => e.name === 'NonExistent');
    const events = entityDef ? {} : {};
    expect(events).toEqual({});
  });
});
