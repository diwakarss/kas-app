/**
 * Pattern Dictionary Types
 *
 * Types for extracted patterns from golden templates.
 */

import type { FieldType, RelationshipType, ComputedFieldType } from '../../core/types/spec';

/**
 * A reusable entity pattern extracted from templates.
 */
export interface EntityPattern {
  /** Pattern name (e.g., "person", "transaction", "appointment") */
  name: string;
  /** Common field patterns for this entity type */
  common_fields: FieldPattern[];
  /** Common relationship patterns */
  common_relationships: RelationshipPattern[];
  /** Examples from golden templates */
  examples: string[];
}

/**
 * A reusable field pattern.
 */
export interface FieldPattern {
  /** Semantic name (e.g., "name", "phone", "amount") */
  name: string;
  /** Typical field type */
  type: FieldType;
  /** Is this typically required? */
  typically_required: boolean;
  /** Is this typically searchable? */
  typically_searchable: boolean;
  /** Common prefixes/suffixes */
  formatting?: {
    prefix?: string;
    suffix?: string;
  };
}

/**
 * A reusable relationship pattern.
 */
export interface RelationshipPattern {
  /** Relationship semantic (e.g., "owner", "child", "event") */
  semantic: string;
  /** Relationship type */
  type: RelationshipType;
  /** FK naming convention */
  fk_pattern: string;
}

/**
 * A computed field pattern.
 */
export interface ComputedPattern {
  /** Semantic name (e.g., "total_count", "total_amount", "days_since_last") */
  name: string;
  /** Computed field type */
  type: ComputedFieldType;
  /** Required dependencies */
  requires: {
    source_entity?: boolean;
    source_field?: boolean;
    date_field?: boolean;
    formula?: boolean;
  };
}

/**
 * Business rule pattern.
 */
export interface RulePattern {
  /** Rule category */
  category: 'payment' | 'scheduling' | 'inventory' | 'reminder';
  /** Condition type */
  condition_type: string;
  /** Warning severity */
  default_severity: 'info' | 'warning' | 'urgent';
}

/**
 * The complete pattern dictionary.
 */
export interface PatternDictionary {
  version: number;
  extracted_from: string[];
  entity_patterns: EntityPattern[];
  field_patterns: FieldPattern[];
  computed_patterns: ComputedPattern[];
  rule_patterns: RulePattern[];
}
