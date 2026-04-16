/**
 * Screen Swap Tests
 *
 * Verifies that the screen swap correctly wires spec builders
 * to the json-render Renderer. Tests validate the integration
 * between hooks → spec builders → registry → Renderer.
 */

import { buildAnchorSpec } from '../../src/ui/spec-builders/anchor';
import { buildStorySpec } from '../../src/ui/spec-builders/story';
import { buildCalendarSpec } from '../../src/ui/spec-builders/calendar';
import { convertV1toV2, ensureV2 } from '../../src/core/types/kas-spec-v2';
import { SpecLibrary } from '../../src/generation/services/spec-library';
import { catalog } from '../../src/ui/catalog';
import { validateSpec } from '@json-render/core';
import type { AnchorData } from '../../src/hooks/useAnchorData';
import type { StoryData } from '../../src/hooks/useStoryData';
import type { CalendarData } from '../../src/hooks/useCalendarData';

function getTutorV2() {
  return convertV1toV2(SpecLibrary.getTemplate('tutor')!);
}

function mockAnchorData(): AnchorData {
  return {
    greeting: 'Good morning',
    dateLabel: 'Today',
    cards: [
      {
        id: 1, title: 'Asha', subtitle: 'Scales', time: '10:00',
        warningText: null, warnings: [], rawData: { id: 1, student_id: 5 }, relatedData: {},
      },
    ],
    emptyMessage: 'No classes', emptyAction: 'Schedule',
    stats: [{ label: 'Today', value: 2 }],
  };
}

function mockStoryData(): StoryData {
  return {
    entity: { id: 5, name: 'Asha Kumar', grade: 'Grade 4' },
    entityType: 'Student',
    entityDef: { name: 'Student', display_name: 'Student', icon: '🎓' },
    statsCard: [{ label: 'Rate', value: 'Rs.500/hr' }],
    comingUp: [{ display: 'Theory', id: 10, sortDate: '2026-04-17T10:00:00Z' }],
    events: [
      {
        id: 1, sourceEntity: 'class', eventType: 'completed',
        display: 'Scales completed', iconColor: '#6B9E78',
        sortDate: '2026-04-15T10:00:00Z', rawData: {},
      },
    ],
    origin: 'Started 2026-01-15', context: 'Learning since Jan',
    warnings: [], hasMore: false, totalLoaded: 1,
  };
}

function mockCalendarData(): CalendarData {
  return {
    year: 2026, month: 4,
    events: { '2026-04-16': [{ id: 1, entityType: 'Class', display: '10:00 - Asha', statusColor: 'stream', sortDate: '2026-04-16T10:00:00Z', raw: {} }] },
    selectedDate: null, selectedEvents: [],
    prevMonth: () => {}, nextMonth: () => {}, selectDate: () => {},
  };
}

describe('Screen swap integration', () => {
  test('AnchorScreen spec is valid and passes catalog validation', () => {
    const spec = buildAnchorSpec(mockAnchorData(), getTutorV2());
    expect(validateSpec(spec).valid).toBe(true);
    expect(catalog.validate(spec).success).toBe(true);
  });

  test('StoryScreen spec is valid and passes catalog validation', () => {
    const spec = buildStorySpec(mockStoryData());
    expect(validateSpec(spec).valid).toBe(true);
    expect(catalog.validate(spec).success).toBe(true);
  });

  test('CalendarScreen spec is valid and passes catalog validation', () => {
    const spec = buildCalendarSpec(mockCalendarData(), getTutorV2());
    expect(validateSpec(spec).valid).toBe(true);
    expect(catalog.validate(spec).success).toBe(true);
  });

  test('AnchorScreen spec includes all expected elements', () => {
    const spec = buildAnchorSpec(mockAnchorData(), getTutorV2());
    expect(spec.elements['greeting']).toBeDefined();
    expect(spec.elements['summary-stats']).toBeDefined();
    expect(spec.elements['card-0']).toBeDefined();
    expect(spec.elements['floating-actions']).toBeDefined();
  });

  test('StoryScreen spec includes all expected elements', () => {
    const spec = buildStorySpec(mockStoryData());
    expect(spec.elements['entity-name']).toBeDefined();
    expect(spec.elements['stats-card']).toBeDefined();
    expect(spec.elements['coming-up-header']).toBeDefined();
    expect(spec.elements['event-0']).toBeDefined();
    expect(spec.elements['origin']).toBeDefined();
  });

  test('CalendarScreen spec includes MonthGrid', () => {
    const spec = buildCalendarSpec(mockCalendarData(), getTutorV2());
    expect(spec.elements['month-grid']).toBeDefined();
    expect(spec.elements['month-grid'].type).toBe('MonthGrid');
  });

  test('ensureV2 handles v1 spec correctly', () => {
    const v1 = SpecLibrary.getTemplate('tutor')!;
    const v2 = ensureV2(v1);
    expect(v2.ui_hints).toBeDefined();
    expect(v2.ui_hints.anchor.entity).toBe(v1.anchor.entity);
  });

  test('ensureV2 passes through v2 spec unchanged', () => {
    const v2 = getTutorV2();
    const result = ensureV2(v2);
    expect(result).toBe(v2);
  });
});
