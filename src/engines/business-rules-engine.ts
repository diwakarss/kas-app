/**
 * Business Rules Engine for KAS App JSON Renderer.
 *
 * Evaluates business rules defined in spec.business_rules against
 * entity data and computed field values. Returns an array of warnings
 * with template-resolved messages.
 *
 * Condition types:
 *   - computed_field_exceeds: computedValues[field] > threshold
 *   - field_empty: value is null/undefined/empty string
 *   - date_passed: date field value < now
 *   - count_below: computedValues[field] < value
 */

import type { KASAppSpec, BusinessRule } from '../core/types/spec';
import { resolveTemplate } from './template-engine';

// ──────────────────────────────────────────
// Public types
// ──────────────────────────────────────────

export interface Warning {
  ruleId: string;
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  showIn: string[];
}

// ──────────────────────────────────────────
// Condition evaluation
// ──────────────────────────────────────────

function evaluateCondition(
  rule: BusinessRule,
  entityData: Record<string, any>,
  computedValues: Record<string, number | string | null>
): boolean {
  const { condition } = rule;
  const thresholdValue = rule.threshold
    ? rule.threshold.default_value
    : condition.value;

  switch (condition.type) {
    case 'computed_field_exceeds': {
      const value = computedValues[condition.field];
      if (value === null || value === undefined) return false;
      const numValue = typeof value === 'number' ? value : Number(value);
      if (isNaN(numValue)) return false;
      return numValue > (thresholdValue ?? 0);
    }

    case 'count_below': {
      const value = computedValues[condition.field];
      if (value === null || value === undefined) return true; // null count = 0 = below any positive threshold
      const numValue = typeof value === 'number' ? value : Number(value);
      if (isNaN(numValue)) return true;
      return numValue < (condition.value ?? 0);
    }

    case 'field_empty': {
      const value = entityData[condition.field];
      return value === null || value === undefined || value === '';
    }

    case 'date_passed': {
      const value = entityData[condition.field];
      if (!value) return false;
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      return dateValue.getTime() < Date.now();
    }

    default:
      return false;
  }
}

// ──────────────────────────────────────────
// Main API
// ──────────────────────────────────────────

/**
 * Evaluate all business rules for a specific entity instance.
 *
 * @param entityType - Entity type name (e.g., "Student")
 * @param entityData - The entity's field data
 * @param computedValues - Already-computed field values for this entity
 * @param spec - The full KASAppSpec
 * @param relatedData - Optional related entity data for template resolution
 * @returns Array of warnings for rules that matched
 */
export function evaluateRules(
  entityType: string,
  entityData: Record<string, any>,
  computedValues: Record<string, number | string | null>,
  spec: KASAppSpec,
  relatedData?: Record<string, Record<string, any>>
): Warning[] {
  const warnings: Warning[] = [];

  for (const rule of spec.business_rules) {
    if (rule.entity !== entityType) continue;

    if (evaluateCondition(rule, entityData, computedValues)) {
      // Merge entity data + computed values for template resolution
      const templateData: Record<string, any> = {
        ...entityData,
        ...computedValues,
      };

      const message = resolveTemplate(
        rule.warning.message,
        templateData,
        relatedData
      );

      warnings.push({
        ruleId: rule.id,
        message,
        severity: rule.warning.severity,
        showIn: rule.warning.show_in,
      });
    }
  }

  return warnings;
}

/**
 * Filter warnings to only those that should show in a specific location.
 */
export function filterWarningsByLocation(
  warnings: Warning[],
  location: string
): Warning[] {
  return warnings.filter((w) => w.showIn.includes(location));
}
