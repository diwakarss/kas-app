/**
 * Business Rules Engine Tests
 *
 * Tests all condition types, template resolution, severity mapping,
 * and show_in filtering against tutor spec rules.
 */

import { evaluateRules, filterWarningsByLocation, Warning } from '../../src/engines/business-rules-engine';
import type { KASAppSpec } from '../../src/core/types/spec';
import tutorSpec from '../../assets/templates/tutor.json';

const spec = tutorSpec as unknown as KASAppSpec;

describe('Business Rules Engine — Condition Types', () => {
  test('computed_field_exceeds: triggers when value exceeds threshold', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: 45, due_amount: 2000 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeDefined();
    expect(overdue!.severity).toBe('warning');
  });

  test('computed_field_exceeds: does NOT trigger at threshold boundary', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: 30, due_amount: 100, upcoming_class_count: 3 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeUndefined();
  });

  test('computed_field_exceeds: does NOT trigger below threshold', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: 10, due_amount: 100, upcoming_class_count: 3 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeUndefined();
  });

  test('computed_field_exceeds: null value does not trigger', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: null, due_amount: 0, upcoming_class_count: 1 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeUndefined();
  });

  test('count_below: triggers when count is below threshold', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: 5, due_amount: 0, upcoming_class_count: 0 },
      spec
    );
    const noClasses = warnings.find((w) => w.ruleId === 'no_classes_scheduled');
    expect(noClasses).toBeDefined();
    expect(noClasses!.severity).toBe('info');
  });

  test('count_below: does NOT trigger at threshold value', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Priya' },
      { days_since_last_payment: 5, due_amount: 0, upcoming_class_count: 1 },
      spec
    );
    const noClasses = warnings.find((w) => w.ruleId === 'no_classes_scheduled');
    expect(noClasses).toBeUndefined();
  });

  test('large_due_amount: triggers for urgent severity', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Rahul' },
      { days_since_last_payment: 5, due_amount: 6000, upcoming_class_count: 2 },
      spec
    );
    const large = warnings.find((w) => w.ruleId === 'large_due_amount');
    expect(large).toBeDefined();
    expect(large!.severity).toBe('urgent');
  });
});

describe('Business Rules Engine — Template Resolution', () => {
  test('message template resolves with entity + computed data', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Rahul' },
      { days_since_last_payment: 45, due_amount: 2500, upcoming_class_count: 2 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeDefined();
    expect(overdue!.message).toBe('Rs.2500 overdue for Rahul');
  });

  test('large_due_amount message resolves correctly', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Ananya' },
      { days_since_last_payment: 5, due_amount: 7500, upcoming_class_count: 1 },
      spec
    );
    const large = warnings.find((w) => w.ruleId === 'large_due_amount');
    expect(large).toBeDefined();
    expect(large!.message).toContain('Rs.7500');
  });
});

describe('Business Rules Engine — Show In Filtering', () => {
  test('filterWarningsByLocation returns only matching warnings', () => {
    const warnings: Warning[] = [
      { ruleId: 'a', message: 'A', severity: 'warning', showIn: ['card', 'story'] },
      { ruleId: 'b', message: 'B', severity: 'info', showIn: ['story'] },
      { ruleId: 'c', message: 'C', severity: 'urgent', showIn: ['notification'] },
    ];

    const cardWarnings = filterWarningsByLocation(warnings, 'card');
    expect(cardWarnings).toHaveLength(1);
    expect(cardWarnings[0].ruleId).toBe('a');

    const storyWarnings = filterWarningsByLocation(warnings, 'story');
    expect(storyWarnings).toHaveLength(2);

    const notifWarnings = filterWarningsByLocation(warnings, 'notification');
    expect(notifWarnings).toHaveLength(1);
    expect(notifWarnings[0].ruleId).toBe('c');
  });

  test('overdue_payment shows in card, story, anchor', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Test' },
      { days_since_last_payment: 45, due_amount: 2000, upcoming_class_count: 2 },
      spec
    );
    const overdue = warnings.find((w) => w.ruleId === 'overdue_payment');
    expect(overdue).toBeDefined();
    expect(overdue!.showIn).toContain('card');
    expect(overdue!.showIn).toContain('story');
    expect(overdue!.showIn).toContain('anchor');
  });
});

describe('Business Rules Engine — Edge Cases', () => {
  test('no rules match returns empty array', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Good Student' },
      { days_since_last_payment: 5, due_amount: 0, upcoming_class_count: 3 },
      spec
    );
    expect(warnings).toHaveLength(0);
  });

  test('rules only evaluate for matching entity type', () => {
    const warnings = evaluateRules(
      'Class',
      { topic: 'Math' },
      {},
      spec
    );
    // All tutor spec rules are for "Student" entity
    expect(warnings).toHaveLength(0);
  });

  test('multiple rules can trigger simultaneously', () => {
    const warnings = evaluateRules(
      'Student',
      { name: 'Trouble' },
      { days_since_last_payment: 60, due_amount: 8000, upcoming_class_count: 0 },
      spec
    );
    // overdue_payment + large_due_amount + no_classes_scheduled = 3
    expect(warnings).toHaveLength(3);
  });
});
