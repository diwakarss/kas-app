/**
 * Anchor Spec Builder Tests
 *
 * Verifies that buildAnchorSpec produces valid json-render specs
 * from anchor hook data.
 */

import { buildAnchorSpec } from '../../../src/ui/spec-builders/anchor';
import { catalog } from '../../../src/ui/catalog';
import { convertV1toV2 } from '../../../src/core/types/kas-spec-v2';
import { SpecLibrary } from '../../../src/generation/services/spec-library';
import { validateSpec } from '@json-render/core';
import type { AnchorData, AnchorCard } from '../../../src/hooks/useAnchorData';

function makeMockCard(overrides: Partial<AnchorCard> = {}): AnchorCard {
  return {
    id: 1,
    title: 'Asha Kumar',
    subtitle: 'Grade 4 - Scales',
    time: '10:00',
    warningText: null,
    warnings: [],
    rawData: { id: 1, student_id: 5, datetime: '2026-04-16T10:00:00Z' },
    relatedData: {},
    ...overrides,
  };
}

function makeMockAnchorData(overrides: Partial<AnchorData> = {}): AnchorData {
  return {
    greeting: 'Good morning',
    dateLabel: 'Today',
    cards: [makeMockCard(), makeMockCard({ id: 2, title: 'Ravi Singh', time: '11:00' })],
    emptyMessage: 'No classes today',
    emptyAction: 'Schedule a class',
    stats: [
      { label: 'Today', value: 2 },
      { label: 'This week', value: 8 },
    ],
    ...overrides,
  };
}

function getTutorV2() {
  return convertV1toV2(SpecLibrary.getTemplate('tutor')!);
}

describe('buildAnchorSpec', () => {
  test('produces a valid json-render spec', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
  });

  test('passes catalog validation', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('includes Greeting element', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    expect(spec.elements['greeting']).toBeDefined();
    expect(spec.elements['greeting'].type).toBe('Greeting');
    expect(spec.elements['greeting'].props.greeting).toBe('Good morning');
  });

  test('includes SummaryStats element', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    expect(spec.elements['summary-stats']).toBeDefined();
    expect(spec.elements['summary-stats'].type).toBe('SummaryStats');
  });

  test('includes EntityCard elements for each card', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    expect(spec.elements['card-0']).toBeDefined();
    expect(spec.elements['card-0'].type).toBe('EntityCard');
    expect(spec.elements['card-0'].props.title).toBe('Asha Kumar');
    expect(spec.elements['card-1']).toBeDefined();
    expect(spec.elements['card-1'].props.title).toBe('Ravi Singh');
  });

  test('EntityCards have navigate action bound to press', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    const card = spec.elements['card-0'];
    expect(card.on).toBeDefined();
    expect((card.on as any).press.action).toBe('navigate');
    expect((card.on as any).press.params.screen).toBe('Story');
  });

  test('shows EmptyState when no cards', () => {
    const spec = buildAnchorSpec(
      makeMockAnchorData({ cards: [] }),
      getTutorV2(),
    );
    expect(spec.elements['empty-state']).toBeDefined();
    expect(spec.elements['empty-state'].type).toBe('EmptyState');
    expect(spec.elements['empty-state'].props.message).toBe('No classes today');
  });

  test('includes FloatingActions with add flow entities', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    expect(spec.elements['floating-actions']).toBeDefined();
    expect(spec.elements['floating-actions'].type).toBe('FloatingActions');
    expect((spec.elements['floating-actions'].props as any).actions.length).toBeGreaterThan(0);
  });

  test('omits SummaryStats when stats are empty', () => {
    const spec = buildAnchorSpec(
      makeMockAnchorData({ stats: [] }),
      getTutorV2(),
    );
    expect(spec.elements['summary-stats']).toBeUndefined();
  });

  test('root element order is guaranteed', () => {
    const spec = buildAnchorSpec(makeMockAnchorData(), getTutorV2());
    const rootChildren = spec.elements['root'].children!;
    const greetingIdx = rootChildren.indexOf('greeting');
    const statsIdx = rootChildren.indexOf('summary-stats');
    const cardsIdx = rootChildren.indexOf('card-list');

    expect(greetingIdx).toBeLessThan(statsIdx);
    expect(statsIdx).toBeLessThan(cardsIdx);
  });
});
