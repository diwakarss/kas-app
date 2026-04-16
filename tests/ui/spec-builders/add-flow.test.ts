/**
 * Add Flow Spec Builder Tests
 */

import { buildAddFlowSpec } from '../../../src/ui/spec-builders/add-flow';
import { catalog } from '../../../src/ui/catalog';
import { validateSpec } from '@json-render/core';
import type { AddFlowInput } from '../../../src/ui/spec-builders/add-flow';

function makeMockInput(overrides: Partial<AddFlowInput> = {}): AddFlowInput {
  return {
    entityDef: {
      name: 'Student',
      display_name: 'Student',
      display_name_plural: 'Students',
      icon: '🎓',
      fields: [
        { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
        { name: 'phone', display_name: 'Phone', type: 'phone', required: false, searchable: true },
      ],
      relationships: [],
    },
    steps: [
      { field: 'name', prompt: 'Name?', required: true, keyboard: 'default' },
      { field: 'phone', prompt: 'Phone?', required: false, skip_text: 'skip', keyboard: 'phone' },
    ],
    currentStep: 0,
    totalSteps: 2,
    currentStepDef: { field: 'name', prompt: 'Name?', required: true, keyboard: 'default' },
    fieldDef: { name: 'name', display_name: 'Name', type: 'text', required: true, searchable: true },
    currentValue: '',
    canAdvance: false,
    isLastStep: false,
    contextSummary: '',
    ...overrides,
  };
}

describe('buildAddFlowSpec', () => {
  test('produces a valid json-render spec', () => {
    const spec = buildAddFlowSpec(makeMockInput());
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
  });

  test('passes catalog validation', () => {
    const spec = buildAddFlowSpec(makeMockInput());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test('includes StepProgress', () => {
    const spec = buildAddFlowSpec(makeMockInput());
    expect(spec.elements['step-progress']).toBeDefined();
    expect(spec.elements['step-progress'].type).toBe('StepProgress');
    expect(spec.elements['step-progress'].props.currentStep).toBe(1);
    expect(spec.elements['step-progress'].props.totalSteps).toBe(2);
  });

  test('includes field prompt and FieldRenderer', () => {
    const spec = buildAddFlowSpec(makeMockInput());
    expect(spec.elements['prompt']).toBeDefined();
    expect(spec.elements['prompt'].props.text).toBe('Name?');
    expect(spec.elements['field']).toBeDefined();
    expect(spec.elements['field'].type).toBe('FieldRenderer');
    expect(spec.elements['field'].props.fieldType).toBe('text');
  });

  test('shows skip button for optional fields', () => {
    const spec = buildAddFlowSpec(
      makeMockInput({
        currentStep: 1,
        currentStepDef: { field: 'phone', prompt: 'Phone?', required: false, skip_text: 'skip', keyboard: 'phone' },
        fieldDef: { name: 'phone', display_name: 'Phone', type: 'phone', required: false, searchable: true },
      }),
    );
    expect(spec.elements['skip-btn']).toBeDefined();
    expect(spec.elements['skip-btn'].props.label).toBe('skip');
  });

  test('does not show skip for required fields', () => {
    const spec = buildAddFlowSpec(makeMockInput());
    expect(spec.elements['skip-btn']).toBeUndefined();
  });

  test('shows Save on last step', () => {
    const spec = buildAddFlowSpec(makeMockInput({ isLastStep: true }));
    expect(spec.elements['next-btn'].props.label).toBe('Save');
  });

  test('shows Next on non-last step', () => {
    const spec = buildAddFlowSpec(makeMockInput({ isLastStep: false }));
    expect(spec.elements['next-btn'].props.label).toBe('Next');
  });

  test('disables Next when canAdvance is false', () => {
    const spec = buildAddFlowSpec(makeMockInput({ canAdvance: false }));
    expect(spec.elements['next-btn'].props.disabled).toBe(true);
  });

  test('shows Back button on step > 0', () => {
    const spec = buildAddFlowSpec(makeMockInput({ currentStep: 1 }));
    expect(spec.elements['back-btn']).toBeDefined();
  });

  test('hides Back button on step 0', () => {
    const spec = buildAddFlowSpec(makeMockInput({ currentStep: 0 }));
    expect(spec.elements['back-btn']).toBeUndefined();
  });
});
