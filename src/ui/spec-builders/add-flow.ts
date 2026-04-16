/**
 * Add Flow Screen Spec Builder
 *
 * Converts add flow state into a json-render {root, elements} spec.
 * Shows: StepProgress → Field prompt → FieldRenderer → Navigation buttons
 */

import type { Spec } from '@json-render/core';
import type { AddFlowStep, Entity, Field } from '../../core/types/spec';

export interface AddFlowInput {
  entityDef: Entity;
  steps: AddFlowStep[];
  currentStep: number;
  totalSteps: number;
  currentStepDef: AddFlowStep | null;
  fieldDef: Field | null;
  currentValue: unknown;
  canAdvance: boolean;
  isLastStep: boolean;
  contextSummary: string;
}

export function buildAddFlowSpec(input: AddFlowInput): Spec {
  const elements: Record<string, any> = {};
  const rootChildren: string[] = [];

  // Step progress
  elements['step-progress'] = {
    type: 'StepProgress',
    props: {
      currentStep: input.currentStep + 1,
      totalSteps: input.totalSteps,
      label: input.entityDef.display_name,
    },
    children: [],
  };
  rootChildren.push('step-progress');

  // Context summary (if available)
  if (input.contextSummary) {
    elements['context'] = {
      type: 'Paragraph',
      props: { text: input.contextSummary, fontSize: 13, color: '#B8AFA6' },
      children: [],
    };
    rootChildren.push('context');
  }

  // Current field
  if (input.currentStepDef && input.fieldDef) {
    elements['prompt'] = {
      type: 'Heading',
      props: { text: input.currentStepDef.prompt, level: 'h3' },
      children: [],
    };
    rootChildren.push('prompt');

    elements['field'] = {
      type: 'FieldRenderer',
      props: {
        fieldType: input.fieldDef.type,
        value: input.currentValue ?? null,
        label: input.fieldDef.display_name,
        required: input.currentStepDef.required,
        placeholder: input.currentStepDef.placeholder ?? input.fieldDef.placeholder ?? null,
        prefix: input.currentStepDef.prefix ?? input.fieldDef.prefix ?? null,
        suffix: input.currentStepDef.suffix ?? input.fieldDef.suffix ?? null,
        options: input.fieldDef.options ?? null,
        allowCustom: input.fieldDef.allow_custom ?? false,
      },
      children: [],
    };
    rootChildren.push('field');

    // Skip button (if not required)
    if (!input.currentStepDef.required && input.currentStepDef.skip_text) {
      elements['skip-btn'] = {
        type: 'Button',
        props: {
          label: input.currentStepDef.skip_text,
          variant: 'ghost',
          size: 'sm',
        },
        children: [],
        on: { press: { action: 'setState', params: { statePath: '/addflow/skip', value: true } } },
      };
      rootChildren.push('skip-btn');
    }
  }

  // Navigation buttons
  const navChildren: string[] = [];

  if (input.currentStep > 0) {
    elements['back-btn'] = {
      type: 'Button',
      props: { label: 'Back', variant: 'outline', size: 'md' },
      children: [],
      on: { press: { action: 'setState', params: { statePath: '/addflow/back', value: true } } },
    };
    navChildren.push('back-btn');
  }

  elements['next-btn'] = {
    type: 'Button',
    props: {
      label: input.isLastStep ? 'Save' : 'Next',
      variant: 'primary',
      size: 'md',
      disabled: !input.canAdvance,
    },
    children: [],
    on: { press: { action: 'setState', params: { statePath: '/addflow/next', value: true } } },
  };
  navChildren.push('next-btn');

  elements['nav-row'] = {
    type: 'Row',
    props: { gap: 12, justifyContent: 'space-between', padding: 20 },
    children: navChildren,
  };
  rootChildren.push('nav-row');

  // Root
  elements['root'] = {
    type: 'SafeArea',
    props: { backgroundColor: '#FAF7F2' },
    children: rootChildren,
  };

  return { root: 'root', elements };
}
