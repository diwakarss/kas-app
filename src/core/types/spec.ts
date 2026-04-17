/**
 * KAS App Spec TypeScript Interfaces
 *
 * Defines the complete contract for spec.json — the declarative
 * description of an entire business application.
 */

// ──────────────────────────────────────────
// Field Types
// ──────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'phone'
  | 'email'
  | 'choice'
  | 'date'
  | 'datetime'
  | 'time'
  | 'toggle'
  | 'duration'
  | 'note'
  | 'image';

export interface Field {
  name: string;
  display_name: string;
  type: FieldType;
  required: boolean;
  searchable: boolean;
  default_value?: string | number | boolean;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: string[];
  allow_custom?: boolean;
}

// ──────────────────────────────────────────
// Relationships
// ──────────────────────────────────────────

export type RelationshipType = 'belongs_to' | 'has_many';

export interface Relationship {
  target: string;
  type: RelationshipType;
  foreign_key: string;
  display_in_story: boolean;
}

// ──────────────────────────────────────────
// Entities
// ──────────────────────────────────────────

export interface Entity {
  name: string;
  display_name: string;
  display_name_plural: string;
  icon: string;
  fields: Field[];
  relationships: Relationship[];
}

// ──────────────────────────────────────────
// Meta
// ──────────────────────────────────────────

export interface VersionHistoryEntry {
  version: number;
  date: string;
  source: string;
  changes: string;
}

export interface SpecMeta {
  spec_id: string;
  name: string;
  version: number;
  business_type: string;
  created_date: string;
  base_template: string;
  source: string;
  generation_confidence: number;
  version_history: VersionHistoryEntry[];
  customizations: string[];
  // Version lineage fields (Wave 1 Bridge Work)
  template_family?: string;
  template_version?: number;
  spec_version?: number;
  // Policy version for event envelope governance (Wave 2 Bridge Work)
  policy_version?: number;
}

// ──────────────────────────────────────────
// Anchor
// ──────────────────────────────────────────

export type AnchorType = 'day_schedule' | 'yesterday_summary' | 'upcoming_project' | 'active_list';

export interface CardDisplay {
  title: string;
  subtitle: string;
  time_field?: string;
  warning_field?: string;
  warning_template?: string;
  actions: string[];
}

export interface AnchorEmptyState {
  message: string;
  action?: string;
  fallback_view?: string;
}

export interface AnchorSummaryStat {
  label: string;
  query: string;
}

export interface AnchorSummary {
  stats: AnchorSummaryStat[];
}

export interface Anchor {
  type: AnchorType;
  entity: string;
  greeting_template: string;
  date_label: string;
  card_display: CardDisplay;
  empty_state: AnchorEmptyState;
  summary: AnchorSummary;
}

// ──────────────────────────────────────────
// Story Events
// ──────────────────────────────────────────

export interface StoryEventFilter {
  field: string;
  value: string;
  condition?: string;
}

export interface StoryEvent {
  source: string;
  relationship: string;
  type: string;
  filter?: StoryEventFilter;
  display: string;
  icon_color: string;
}

export interface StatsCardItem {
  label: string;
  field?: string;
  computed?: string;
}

export interface ComingUp {
  source: string;
  relationship: string;
  filter: string;
  sort: string;
  display: string;
}

export interface StoryOrigin {
  display: string;
}

export interface StoryContext {
  display: string;
}

export interface StoryConfig {
  events: StoryEvent[];
  stats_card: StatsCardItem[];
  coming_up: ComingUp | null;
  origin: StoryOrigin;
  context: StoryContext;
}

export type StoryEventsConfig = Record<string, StoryConfig>;

// ──────────────────────────────────────────
// Add Flows
// ──────────────────────────────────────────

export type AddFlowFieldType = 'entity_picker';

export interface AddFlowStep {
  field: string;
  prompt: string;
  required: boolean;
  keyboard?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  skip_text?: string;
  /** Step-level renderer override (does not modify the underlying Field.type).
   *  'entity_picker' routes an `_id` FK step through the EntityPicker component. */
  field_type?: AddFlowFieldType;
  /** Target entity name when field_type === 'entity_picker'. */
  entity_target?: string;
}

export interface AfterAdd {
  action: 'suggest' | 'navigate' | 'none';
  text?: string;
  target?: string;
  pre_fill?: Record<string, string>;
}

export interface AddFlow {
  steps: AddFlowStep[];
  after_add: AfterAdd;
}

export type AddFlowsConfig = Record<string, AddFlow>;

// ──────────────────────────────────────────
// Search
// ──────────────────────────────────────────

export interface SearchConfig {
  entities: string[];
  display: Record<string, string>;
}

// ──────────────────────────────────────────
// Calendar
// ──────────────────────────────────────────

export interface CalendarConfig {
  entity: string;
  date_field: string;
  display: string;
  color_field?: string;
}

// ──────────────────────────────────────────
// Chat Commands
// ──────────────────────────────────────────

export interface ChatCommandAction {
  type: string;
  entity?: string;
  lookup_field?: string;
  target_field?: string;
  pre_fill?: Record<string, string>;
  fields?: Record<string, string>;
  name?: string;
  description?: string;
}

export interface ChatCommandVariable {
  type: string;
  entity?: string;
  field?: string;
}

export interface ChatCommand {
  pattern: string;
  aliases: string[];
  action: ChatCommandAction;
  variables?: Record<string, ChatCommandVariable>;
  requires_confirmation: boolean;
  confirmation_template?: string;
}

// ──────────────────────────────────────────
// Business Rules
// ──────────────────────────────────────────

export type ConditionType = 'computed_field_exceeds' | 'field_empty' | 'date_passed' | 'count_below';

export interface RuleCondition {
  type: ConditionType;
  field: string;
  value?: number;
}

export interface RuleWarning {
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  show_in: string[];
}

export interface RuleThreshold {
  field: string;
  default_value: number;
  label: string;
  user_adjustable?: boolean;
}

export interface BusinessRule {
  id: string;
  name: string;
  entity: string;
  condition: RuleCondition;
  warning: RuleWarning;
  threshold?: RuleThreshold;
}

// ──────────────────────────────────────────
// Computed Fields
// ──────────────────────────────────────────

export type ComputedFieldType = 'count' | 'sum' | 'days_since' | 'days_until' | 'latest' | 'formula';

export interface ComputedFieldFilter {
  field: string;
  condition: string;
  value: string;
}

export interface ComputedField {
  name: string;
  display_name: string;
  type: ComputedFieldType;
  format?: string;
  prefix?: string;
  suffix?: string;
  // SQL aggregate fields
  source_entity?: string;
  source_field?: string;
  relationship?: string;
  date_field?: string;
  filter?: ComputedFieldFilter;
  // Formula fields
  formula?: string;
}

export type ComputedFieldsConfig = Record<string, ComputedField[]>;

// ──────────────────────────────────────────
// Root Spec
// ──────────────────────────────────────────

export interface KASAppSpec {
  meta: SpecMeta;
  entities: Entity[];
  anchor: Anchor;
  story_events: StoryEventsConfig;
  add_flows: AddFlowsConfig;
  search: SearchConfig;
  calendar: CalendarConfig;
  chat_commands: ChatCommand[];
  business_rules: BusinessRule[];
  computed_fields: ComputedFieldsConfig;
}
