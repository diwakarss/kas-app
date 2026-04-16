/**
 * KAS App Spec v2 Type Definitions
 *
 * v2 wraps the original business-layer types with a ui_hints sub-object.
 * The UI-specific fields (anchor, story_events, add_flows, search, calendar)
 * move into ui_hints, keeping the business schema clean. The json-render
 * UI spec ({root, elements}) is built at runtime by spec builders from
 * ui_hints + live data — it is NOT stored in the spec.
 *
 * v1 types (Entity, Field, Relationship, etc.) are re-exported unchanged.
 */

import type {
  SpecMeta,
  Entity,
  Field,
  Relationship,
  FieldType,
  RelationshipType,
  Anchor,
  StoryEventsConfig,
  AddFlowsConfig,
  SearchConfig,
  CalendarConfig,
  ChatCommand,
  BusinessRule,
  ComputedFieldsConfig,
  KASAppSpec as KASAppSpecV1,
} from './spec';

// Re-export all v1 types that don't change
export type {
  SpecMeta,
  Entity,
  Field,
  Relationship,
  FieldType,
  RelationshipType,
  Anchor,
  StoryEventsConfig,
  AddFlowsConfig,
  SearchConfig,
  CalendarConfig,
  ChatCommand,
  BusinessRule,
  ComputedFieldsConfig,
  KASAppSpecV1,
};

// ──────────────────────────────────────────
// UI Hints — layout preferences consumed by spec builders at runtime
// ──────────────────────────────────────────

export interface UIHints {
  anchor: Anchor;
  story_events: StoryEventsConfig;
  add_flows: AddFlowsConfig;
  search: SearchConfig;
  calendar: CalendarConfig;
}

// ──────────────────────────────────────────
// KAS App Spec v2
// ──────────────────────────────────────────

export interface KASAppSpecV2 {
  meta: SpecMeta;
  entities: Entity[];
  computed_fields: ComputedFieldsConfig;
  business_rules: BusinessRule[];
  chat_commands: ChatCommand[];
  ui_hints: UIHints;
}

/** The spec version number for v2 */
export const SPEC_FORMAT_VERSION = 2;

// ──────────────────────────────────────────
// Conversion
// ──────────────────────────────────────────

/**
 * Convert a v1 spec to v2 by moving UI fields into ui_hints.
 * This is a lossless, reversible transformation.
 */
export function convertV1toV2(v1: KASAppSpecV1): KASAppSpecV2 {
  return {
    meta: {
      ...v1.meta,
      spec_version: SPEC_FORMAT_VERSION,
    },
    entities: v1.entities,
    computed_fields: v1.computed_fields,
    business_rules: v1.business_rules,
    chat_commands: v1.chat_commands,
    ui_hints: {
      anchor: v1.anchor,
      story_events: v1.story_events,
      add_flows: v1.add_flows,
      search: v1.search,
      calendar: v1.calendar,
    },
  };
}

/**
 * Convert a v2 spec back to v1 by flattening ui_hints.
 * Used for rollback if the migration needs to be reverted.
 */
export function convertV2toV1(v2: KASAppSpecV2): KASAppSpecV1 {
  const { ui_hints, ...rest } = v2;
  return {
    ...rest,
    anchor: ui_hints.anchor,
    story_events: ui_hints.story_events,
    add_flows: ui_hints.add_flows,
    search: ui_hints.search,
    calendar: ui_hints.calendar,
  };
}

/**
 * Detect whether a raw spec object is v1 or v2 format.
 * v2 has ui_hints; v1 has anchor at the top level.
 */
export function detectSpecVersion(spec: unknown): 1 | 2 {
  if (spec && typeof spec === 'object' && 'ui_hints' in spec) {
    return 2;
  }
  return 1;
}

/**
 * Ensure a spec is in v2 format, converting from v1 if needed.
 */
export function ensureV2(spec: KASAppSpecV1 | KASAppSpecV2): KASAppSpecV2 {
  if ('ui_hints' in spec) {
    return spec as KASAppSpecV2;
  }
  return convertV1toV2(spec as KASAppSpecV1);
}
