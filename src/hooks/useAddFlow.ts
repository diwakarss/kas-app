/**
 * useAddFlow Hook for KAS App JSON Renderer.
 *
 * State machine for the Add Flow — manages step navigation,
 * FK resolution, value tracking, validation, and submission.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSpec } from '../core/context/SpecContext';
import type { AddFlowStep, AfterAdd, Entity, Field } from '../core/types/spec';

interface AddFlowState {
  entityDef: Entity | null;
  steps: AddFlowStep[];
  currentStep: number;
  totalSteps: number;
  currentStepDef: AddFlowStep | null;
  fieldDef: Field | null;
  values: Record<string, any>;
  currentValue: any;
  canAdvance: boolean;
  isLastStep: boolean;
  afterAdd: AfterAdd | null;
  contextSummary: string;
  fkTarget: string | null;
  fkOptions: Record<string, any>[];
  setValue: (value: any) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  submit: () => number | null;
}

export function useAddFlow(entityType: string, preFill?: Record<string, any>): AddFlowState {
  const { spec, crud } = useSpec();
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, any>>(preFill ?? {});

  const entityDef = useMemo(
    () => spec?.entities.find(e => e.name === entityType) ?? null,
    [spec, entityType]
  );

  const flowConfig = useMemo(
    () => spec?.add_flows[entityType] ?? null,
    [spec, entityType]
  );

  const steps = flowConfig?.steps ?? [];
  const afterAdd = flowConfig?.after_add ?? null;
  const totalSteps = steps.length;
  const currentStepDef = steps[currentStep] ?? null;

  // Determine if this step is a FK picker
  const fkInfo = useMemo(() => {
    if (!currentStepDef || !entityDef) return null;
    const rel = entityDef.relationships.find(
      r => r.foreign_key === currentStepDef.field && r.type === 'belongs_to'
    );
    return rel ? { target: rel.target, fk: rel.foreign_key } : null;
  }, [currentStepDef, entityDef]);

  // FK options
  const fkOptions = useMemo(() => {
    if (!fkInfo || !crud) return [];
    return crud.list(fkInfo.target);
  }, [fkInfo, crud]);

  // Field definition for non-FK steps
  const fieldDef = useMemo(() => {
    if (fkInfo || !entityDef || !currentStepDef) return null;
    return entityDef.fields.find(f => f.name === currentStepDef.field) ?? null;
  }, [fkInfo, entityDef, currentStepDef]);

  const currentValue = currentStepDef ? values[currentStepDef.field] : undefined;

  const canAdvance = useMemo(() => {
    if (!currentStepDef) return false;
    if (!currentStepDef.required) return true;
    const val = values[currentStepDef.field];
    return val !== undefined && val !== null && val !== '';
  }, [currentStepDef, values]);

  const isLastStep = currentStep === totalSteps - 1;

  // Context summary — show pre-filled values
  const contextSummary = useMemo(() => {
    if (!preFill || !entityDef || !crud) return '';
    const parts: string[] = [];
    for (const [key, val] of Object.entries(preFill)) {
      const rel = entityDef.relationships.find(r => r.foreign_key === key);
      if (rel && typeof val === 'number') {
        const related = crud.read(rel.target, val);
        if (related) {
          parts.push(`${rel.target}: ${related.name || related.content || `#${val}`}`);
        }
      }
    }
    return parts.join(' \u00B7 ');
  }, [preFill, entityDef, crud]);

  const setValue = useCallback((value: any) => {
    if (!currentStepDef) return;
    setValues(prev => ({ ...prev, [currentStepDef.field]: value }));
  }, [currentStepDef]);

  const next = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, totalSteps]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    next();
  }, [next]);

  const submit = useCallback((): number | null => {
    if (!crud) return null;

    // Merge pre-fill + step values, apply defaults
    const data: Record<string, any> = { ...preFill };
    for (const step of steps) {
      const val = values[step.field];
      if (val !== undefined && val !== null && val !== '') {
        data[step.field] = val;
      }
    }

    // Apply field defaults for any fields not set
    if (entityDef) {
      for (const field of entityDef.fields) {
        if (data[field.name] === undefined && field.default_value !== undefined) {
          data[field.name] = field.default_value;
        }
      }
    }

    try {
      return crud.create(entityType, data);
    } catch {
      return null;
    }
  }, [crud, values, steps, preFill, entityType, entityDef]);

  return {
    entityDef,
    steps,
    currentStep,
    totalSteps,
    currentStepDef,
    fieldDef,
    values,
    currentValue,
    canAdvance,
    isLastStep,
    afterAdd,
    contextSummary,
    fkTarget: fkInfo?.target ?? null,
    fkOptions,
    setValue,
    next,
    back,
    skip,
    submit,
  };
}
