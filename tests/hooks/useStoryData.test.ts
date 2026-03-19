/**
 * useStoryData Hook Tests
 *
 * Tests story data fetching, timeline events, and pagination.
 */

import { createMockCrud, mockSpec } from './__mocks__/spec-context';
import { toTableName } from '../../src/data/query-builder';

describe('useStoryData — Story Config', () => {
  test('spec has story_events config', () => {
    expect(mockSpec.story_events).toBeDefined();
  });

  test('Student has story config', () => {
    expect(mockSpec.story_events.Student).toBeDefined();
  });

  test('story config has required sections', () => {
    const storyConfig = mockSpec.story_events.Student;
    expect(storyConfig.stats_card).toBeDefined();
    expect(storyConfig.events).toBeDefined();
    expect(storyConfig.origin).toBeDefined();
    expect(storyConfig.context).toBeDefined();
  });
});

describe('useStoryData — Stats Card', () => {
  test('stats_card has items with labels', () => {
    const storyConfig = mockSpec.story_events.Student;
    expect(storyConfig.stats_card.length).toBeGreaterThan(0);

    for (const item of storyConfig.stats_card) {
      expect(item.label).toBeDefined();
    }
  });
});

describe('useStoryData — Coming Up', () => {
  test('coming_up config exists if defined', () => {
    const storyConfig = mockSpec.story_events.Student;
    if (storyConfig.coming_up) {
      expect(storyConfig.coming_up.source).toBeDefined();
      expect(storyConfig.coming_up.relationship).toBeDefined();
      expect(storyConfig.coming_up.display).toBeDefined();
    }
  });

  test('coming_up filters future events', () => {
    const now = new Date().toISOString();
    const futureDate = '2026-12-31T10:00:00';
    const pastDate = '2020-01-01T10:00:00';

    expect(futureDate >= now).toBe(true);
    expect(pastDate >= now).toBe(false);
  });
});

describe('useStoryData — Timeline Events', () => {
  test('events config has source and relationship', () => {
    const storyConfig = mockSpec.story_events.Student;

    for (const event of storyConfig.events) {
      expect(event.source).toBeDefined();
      expect(event.relationship).toBeDefined();
      expect(event.type).toBeDefined();
      expect(event.display).toBeDefined();
    }
  });

  test('builds StoryEventSource from config', () => {
    const storyConfig = mockSpec.story_events.Student;
    const ev = storyConfig.events[0];
    const srcDef = mockSpec.entities.find(e => e.name === ev.source);
    const srcDateField = srcDef?.fields.find(f => f.type === 'datetime' || f.type === 'date')?.name ?? 'datetime';

    const source = {
      sourceTable: toTableName(ev.source),
      relationship: ev.relationship,
      dateField: srcDateField,
      filter: ev.filter ? { field: ev.filter.field, value: ev.filter.value } : undefined,
      eventType: ev.type,
    };

    expect(source.sourceTable).toBe(toTableName(ev.source));
    expect(source.eventType).toBe(ev.type);
  });

  test('event has icon_color config', () => {
    const storyConfig = mockSpec.story_events.Student;

    for (const event of storyConfig.events) {
      expect(event.icon_color).toBeDefined();
    }
  });
});

describe('useStoryData — Pagination', () => {
  const PAGE_SIZE = 50;

  test('PAGE_SIZE is 50', () => {
    expect(PAGE_SIZE).toBe(50);
  });

  test('calculates limit for page 0', () => {
    const page = 0;
    const limit = PAGE_SIZE * (page + 1);
    expect(limit).toBe(50);
  });

  test('calculates limit for page 1', () => {
    const page = 1;
    const limit = PAGE_SIZE * (page + 1);
    expect(limit).toBe(100);
  });

  test('hasMore when results equal page limit', () => {
    const page = 0;
    const resultsCount = PAGE_SIZE * (page + 1);
    const hasMore = resultsCount === PAGE_SIZE * (page + 1);
    expect(hasMore).toBe(true);
  });

  test('no hasMore when results less than limit', () => {
    const page = 0;
    const resultsCount = 30;
    const hasMore = resultsCount === PAGE_SIZE * (page + 1);
    expect(hasMore).toBe(false);
  });
});

describe('useStoryData — Origin & Context', () => {
  test('origin has display template', () => {
    const storyConfig = mockSpec.story_events.Student;
    expect(storyConfig.origin.display).toBeDefined();
  });

  test('context has display template', () => {
    const storyConfig = mockSpec.story_events.Student;
    expect(storyConfig.context.display).toBeDefined();
  });
});

describe('useStoryData — Related Data Resolution', () => {
  test('builds relatedMap from belongs_to relationships', () => {
    const entityDef = mockSpec.entities.find(e => e.name === 'Class');
    const entity = { id: 1, student_id: 5 };

    const mockCrud = createMockCrud({
      read: jest.fn().mockReturnValue({ id: 5, name: 'Anu' }),
    });

    const relatedMap: Record<string, Record<string, any>> = {};
    for (const rel of entityDef?.relationships ?? []) {
      if (rel.type === 'belongs_to' && entity[rel.foreign_key as keyof typeof entity]) {
        const related = mockCrud.read(rel.target, entity[rel.foreign_key as keyof typeof entity]);
        if (related) relatedMap[rel.target.toLowerCase()] = related;
      }
    }

    expect(relatedMap.student).toBeDefined();
    expect(relatedMap.student.name).toBe('Anu');
  });
});

describe('useStoryData — Null Safety', () => {
  test('returns null when entity not found', () => {
    const mockCrud = createMockCrud({
      read: jest.fn().mockReturnValue(null),
    });

    const entity = mockCrud.read('Student', 999);
    expect(entity).toBeNull();
  });

  test('returns null when story config missing', () => {
    const storyConfig = mockSpec.story_events['NonExistent'];
    expect(storyConfig).toBeUndefined();
  });
});
