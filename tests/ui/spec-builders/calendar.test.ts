/**
 * Calendar Spec Builder Tests
 */

import { buildCalendarSpec } from '../../../src/ui/spec-builders/calendar';
import { catalog } from '../../../src/ui/catalog';
import { convertV1toV2 } from '../../../src/core/types/kas-spec-v2';
import { SpecLibrary } from '../../../src/generation/services/spec-library';
import { validateSpec } from '@json-render/core';
import type { CalendarData, CalendarDayEvent } from '../../../src/hooks/useCalendarData';

function makeMockCalendarData(overrides: Partial<CalendarData> = {}): CalendarData {
  return {
    year: 2026,
    month: 4,
    events: {
      '2026-04-16': [
        {
          id: 1,
          entityType: 'Class',
          display: '10:00 - Asha Kumar - Scales',
          statusColor: 'stream',
          sortDate: '2026-04-16T10:00:00Z',
          raw: {},
        },
      ],
    },
    selectedDate: null,
    selectedEvents: [],
    prevMonth: () => {},
    nextMonth: () => {},
    selectDate: () => {},
    ...overrides,
  };
}

function getTutorV2() {
  return convertV1toV2(SpecLibrary.getTemplate('tutor')!);
}

describe('buildCalendarSpec', () => {
  test('produces a valid json-render spec', () => {
    const spec = buildCalendarSpec(makeMockCalendarData(), getTutorV2());
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
  });

  test('passes catalog validation', () => {
    const spec = buildCalendarSpec(makeMockCalendarData(), getTutorV2());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('includes MonthGrid element', () => {
    const spec = buildCalendarSpec(makeMockCalendarData(), getTutorV2());
    expect(spec.elements['month-grid']).toBeDefined();
    expect(spec.elements['month-grid'].type).toBe('MonthGrid');
    expect(spec.elements['month-grid'].props.entityType).toBe('Class');
    expect(spec.elements['month-grid'].props.dateField).toBe('datetime');
  });

  test('shows DayDetail when date is selected with events', () => {
    const selectedEvents: CalendarDayEvent[] = [
      {
        id: 1, entityType: 'Class', display: '10:00 - Asha',
        statusColor: 'stream', sortDate: '2026-04-16T10:00:00Z', raw: {},
      },
    ];
    const spec = buildCalendarSpec(
      makeMockCalendarData({ selectedDate: '2026-04-16', selectedEvents }),
      getTutorV2(),
    );
    expect(spec.elements['day-detail']).toBeDefined();
    expect(spec.elements['day-detail'].type).toBe('DayDetail');
    expect((spec.elements['day-detail'].props as any).items.length).toBe(1);
  });

  test('shows EmptyState when date is selected but no events', () => {
    const spec = buildCalendarSpec(
      makeMockCalendarData({ selectedDate: '2026-04-20', selectedEvents: [] }),
      getTutorV2(),
    );
    expect(spec.elements['empty-day']).toBeDefined();
    expect(spec.elements['empty-day'].type).toBe('EmptyState');
  });

  test('includes FloatingActions', () => {
    const spec = buildCalendarSpec(makeMockCalendarData(), getTutorV2());
    expect(spec.elements['floating-actions']).toBeDefined();
    expect((spec.elements['floating-actions'].props as any).actions[0].entityType).toBe('Class');
  });
});
