/**
 * Catalog Integration Tests
 *
 * Verifies that validateWithCatalog() bridges old validation with
 * catalog-backed schema checks, and that spec builders validate
 * their output against the catalog before returning.
 */

import { SpecValidator } from '../../src/generation/services/spec-validator';
import { buildAnchorSpec } from '../../src/ui/spec-builders/anchor';
import { buildStorySpec } from '../../src/ui/spec-builders/story';
import { buildAddFlowSpec } from '../../src/ui/spec-builders/add-flow';
import { buildCalendarSpec } from '../../src/ui/spec-builders/calendar';
import { catalog } from '../../src/ui/catalog';
import { SpecLibrary } from '../../src/generation/services/spec-library';
import { ensureV2 } from '../../src/core/types/kas-spec-v2';
import type { AnchorData } from '../../src/hooks/useAnchorData';
import type { StoryData } from '../../src/hooks/useStoryData';
import type { CalendarData } from '../../src/hooks/useCalendarData';
import type { AddFlowInput } from '../../src/ui/spec-builders/add-flow';

const originalWarn = console.warn;
beforeAll(() => { console.warn = jest.fn(); });
afterAll(() => { console.warn = originalWarn; });

function getTutorSpec() {
  return SpecLibrary.getTemplate('tutor')!;
}

describe('Catalog integration — validateWithCatalog', () => {
  test('accepts a valid template spec', () => {
    const result = SpecValidator.validateWithCatalog(getTutorSpec());
    expect(result.success).toBe(true);
    expect(result.repaired).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  test('rejects a spec missing required sections', () => {
    const broken = { meta: {}, entities: [] };
    const result = SpecValidator.validateWithCatalog(broken);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects non-object input', () => {
    const result = SpecValidator.validateWithCatalog('not a spec');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('must be an object');
  });

  test('rejects null input', () => {
    const result = SpecValidator.validateWithCatalog(null);
    expect(result.success).toBe(false);
  });

  test('surfaces warnings for missing story_events on belongs_to target', () => {
    const spec = JSON.parse(JSON.stringify(getTutorSpec()));
    spec.story_events = {};
    const result = SpecValidator.validateWithCatalog(spec);
    if (result.success) {
      expect(result.warnings.length).toBeGreaterThan(0);
    } else {
      expect(result.errors.some(e => e.includes('story_events'))).toBe(true);
    }
  });

  test('surfaces warning for missing card_display', () => {
    const spec = JSON.parse(JSON.stringify(getTutorSpec()));
    delete spec.anchor.card_display;
    const result = SpecValidator.validateWithCatalog(spec);
    if (result.success) {
      expect(result.warnings.some(w => w.includes('card_display'))).toBe(true);
    }
  });
});

describe('Spec builders validate their output', () => {
  const v2Spec = ensureV2(getTutorSpec() as any);

  function mockAnchorData(): AnchorData {
    return {
      greeting: 'Good morning',
      dateLabel: 'Today',
      nextUp: null,
      cards: [
        {
          id: 1, title: 'Asha Kumar', subtitle: 'Grade 4', time: '10:00 AM',
          warningText: null, warnings: [], rawData: { id: 1, student_id: 5 }, relatedData: {},
        },
      ],
      stats: [{ label: 'Classes today', value: 3 }],
      emptyMessage: 'No classes today',
      emptyAction: 'Add a class',
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

  function mockAddFlowInput(): AddFlowInput {
    return {
      entityDef: {
        name: 'Student', display_name: 'Student', display_name_plural: 'Students',
        icon: '🎓',
        fields: [{ name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true }],
        relationships: [],
      },
      steps: [{ field: 'name', prompt: 'Name?', required: true, keyboard: 'default' }],
      currentStep: 0, totalSteps: 1,
      currentStepDef: { field: 'name', prompt: 'Name?', required: true, keyboard: 'default' },
      fieldDef: { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
      currentValue: '', canAdvance: false, isLastStep: true,
      contextSummary: '', fkTarget: null, fkOptions: [],
    };
  }

  test('anchor builder produces catalog-valid spec', () => {
    const spec = buildAnchorSpec(mockAnchorData(), v2Spec);
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('story builder produces catalog-valid spec', () => {
    const spec = buildStorySpec(mockStoryData());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('calendar builder produces catalog-valid spec', () => {
    const spec = buildCalendarSpec(mockCalendarData(), v2Spec);
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('add-flow builder produces catalog-valid spec', () => {
    const spec = buildAddFlowSpec(mockAddFlowInput());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });
});

describe('LLM output self-healing', () => {
  test('catalog accepts partial EntityCard spec with missing optional props', () => {
    const partialSpec = {
      root: 'root',
      elements: {
        root: {
          type: 'Column',
          props: {},
          children: ['card1'],
        },
        card1: {
          type: 'EntityCard',
          props: {
            title: 'Test',
            entityType: 'Student',
            entityId: 1,
          },
          children: [],
        },
      },
    };

    const result = catalog.validate(partialSpec);
    expect(result.success).toBe(true);
    const cardProps = result.data?.elements['card1'].props as any;
    expect(cardProps).toBeDefined();
    expect(cardProps.title).toBe('Test');
    expect(cardProps.entityType).toBe('Student');
    expect(cardProps.entityId).toBe(1);
  });
});
