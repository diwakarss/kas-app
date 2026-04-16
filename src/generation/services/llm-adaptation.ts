/**
 * LLM Adaptation Layer
 *
 * Handles prompt engineering and response parsing for spec generation.
 * Provides reusable methods for both fresh generation and spec modification.
 */

import type { LLMProvider, GenerationResult } from '../types/providers';
import type { KASAppSpec } from '../../core/types/spec';
import { catalog } from '../../ui/catalog';

/**
 * KAS-specific business schema rules appended to the catalog-generated prompt.
 * The catalog handles UI component schemas; these rules handle the business data layer.
 */
const KAS_BUSINESS_RULES = `
BUSINESS DATA SCHEMA:
In addition to the UI spec above, generate a complete business specification JSON object with these sections:

"meta": {
  "name": "Business Name",
  "business_type": "type",
  "version": 1,
  "spec_id": "unique-slug-here",
  "created_date": "ISO date",
  "base_template": "generated",
  "source": "generated",
  "generation_confidence": 0.85,
  "version_history": [{"version": 1, "date": "ISO date", "source": "generated", "changes": "Initial"}],
  "customizations": []
}

"entities": Array of entity definitions. Each entity has:
  - name, display_name, display_name_plural, icon (emoji)
  - fields: [{name, display_name, type, required, searchable, ...}]
  - relationships: [{target, type, foreign_key, display_in_story}]

"anchor": The home screen config:
  - type: "day_schedule" | "yesterday_summary" | "upcoming_project" | "active_list"
  - entity, greeting_template, date_label, card_display, empty_state, summary

"story_events": Record of entity name → {events, stats_card, coming_up, origin, context}
"add_flows": Record of entity name → {steps: [{field, prompt, required, keyboard?, ...}], after_add?}
"search": {entities: string[], display: Record<entity, template>}
"calendar": {entity, date_field, display, color_field?}
"chat_commands": Array of command patterns with actions
"business_rules": Array of warning/threshold rules
"computed_fields": Record of entity name → computed field definitions

Field types: text, number, currency, phone, email, choice, date, datetime, time, toggle, duration, note, image
Relationship types: belongs_to (child has FK to parent), has_many (inverse)
Computed types: count, sum, days_since, days_until, latest, formula

CRITICAL RULES:
1. Every entity must have a "name" or primary text field marked searchable
2. Activity entities must have a datetime field for scheduling
3. FK fields in belongs_to relationships must end with "_id"
4. Choice fields must include an "options" array
5. The calendar entity must have a date or datetime field
6. story_events MUST exist for entities that are belongs_to targets
7. add_flows steps use "field" (singular), NOT "fields" array. Each step is one field.
8. search.display and calendar.display are REQUIRED templates
9. anchor needs card_display, empty_state, and summary sections`;

/**
 * Build the system prompt from catalog + KAS business rules.
 * The catalog generates component/action schemas automatically.
 * We append KAS-specific business data instructions.
 */
export function buildSystemPrompt(customRules?: string[]): string {
  const uiPrompt = catalog.prompt({
    mode: 'standalone',
    customRules: [
      'Always include a root layout element containing all other elements',
      'Every business app needs: a person entity, an activity entity, and optionally a transaction entity',
      'The anchor screen must show today\'s items with greeting, stats, and entity cards',
      'Story screens show a timeline of events for a single entity record',
      'Always include add flows with step-by-step field entry',
      ...(customRules || []),
    ],
  });

  return `/no_think\n${uiPrompt}\n\n${KAS_BUSINESS_RULES}`;
}

/** Cached system prompt for generation (avoid regenerating on every call) */
let _cachedSystemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!_cachedSystemPrompt) {
    _cachedSystemPrompt = buildSystemPrompt();
  }
  return _cachedSystemPrompt;
}

/**
 * Prompt template for fresh spec generation.
 */
function buildGenerationPrompt(
  businessType: string,
  businessName: string,
  features?: string[]
): string {
  let prompt = `Generate a complete app specification for a "${businessType}" business called "${businessName}".

The app should help manage day-to-day operations including scheduling, tracking, and reporting.`;

  if (features && features.length > 0) {
    prompt += `\n\nKey features to include:\n${features.map((f) => `- ${f}`).join('\n')}`;
  }

  prompt += `

Create 3-5 entities that make sense for this business type. Include:
- A main "person" entity (customer/client/student/patient)
- A main "activity" entity (appointment/class/session/transaction)
- Any supporting entities needed

RELATIONSHIPS ARE CRITICAL:
- Activity entities MUST have a belongs_to relationship to the person entity.
  Example: Workout belongs_to Client via "client_id" foreign key.
- Add a foreign key field (e.g. "client_id" with type "number") in the activity entity's fields array.
- The relationship object must have: {"target": "Client", "type": "belongs_to", "foreign_key": "client_id", "display_in_story": true}
- story_events MUST exist for every entity that is a belongs_to target (e.g. Client needs story_events showing Workouts).
- add_flows MUST exist for at least the activity entity with steps for each field.

Return the complete JSON spec with all sections populated.`;

  return prompt;
}

/**
 * Prompt template for spec modification.
 */
function buildModificationPrompt(
  currentSpec: KASAppSpec,
  modification: string
): string {
  return `Here is the current app specification:

\`\`\`json
${JSON.stringify(currentSpec, null, 2)}
\`\`\`

Apply this modification:
${modification}

Return the complete modified JSON spec. Preserve all existing functionality unless explicitly being changed.`;
}

/**
 * Extract JSON from LLM response text.
 * Handles various response formats:
 * - Plain JSON
 * - JSON in markdown code blocks
 * - JSON with surrounding text
 * - Qwen3 <think> tags
 */
export function extractJSON(text: string): string | null {
  // Strip Qwen3 thinking tags first
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  // Also handle unclosed think tags (model cut off)
  cleaned = cleaned.replace(/<think>[\s\S]*$/g, '').trim();

  // Try to find JSON in markdown code block
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * Parse LLM response into a spec object.
 * Attempts to repair common JSON issues.
 */
export function parseResponse(text: string): KASAppSpec {
  const jsonText = extractJSON(text);

  if (!jsonText) {
    throw new Error('No JSON found in LLM response');
  }

  try {
    return JSON.parse(jsonText) as KASAppSpec;
  } catch (parseError: any) {
    // Attempt basic repairs
    let repaired = jsonText;

    // Remove trailing commas before closing brackets
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Try parsing again
    try {
      return JSON.parse(repaired) as KASAppSpec;
    } catch {
      throw new Error(`Failed to parse LLM response as JSON: ${parseError.message}`);
    }
  }
}

/**
 * LLM Adaptation Layer class.
 */
export class LLMAdaptationLayer {
  constructor(private provider: LLMProvider) {}

  /**
   * Generate a new spec from business description.
   */
  async generateSpec(
    businessType: string,
    businessName: string,
    features?: string[]
  ): Promise<{ spec: KASAppSpec; usage: GenerationResult['usage']; latency_ms: number }> {
    const prompt = buildGenerationPrompt(businessType, businessName, features);

    const result = await this.provider.generate(prompt, {
      system_prompt: getSystemPrompt(),
      temperature: 0.7,
      max_tokens: 8192,
    });

    const spec = parseResponse(result.text);

    return {
      spec,
      usage: result.usage,
      latency_ms: result.latency_ms,
    };
  }

  /**
   * Modify an existing spec.
   */
  async modifySpec(
    currentSpec: KASAppSpec,
    modification: string
  ): Promise<{ spec: KASAppSpec; usage: GenerationResult['usage']; latency_ms: number }> {
    const prompt = buildModificationPrompt(currentSpec, modification);

    const result = await this.provider.generate(prompt, {
      system_prompt: getSystemPrompt(),
      temperature: 0.5, // Lower temperature for modifications
      max_tokens: 8192,
    });

    const spec = parseResponse(result.text);

    return {
      spec,
      usage: result.usage,
      latency_ms: result.latency_ms,
    };
  }

  /**
   * Get the underlying provider info.
   */
  getProviderInfo() {
    return this.provider.getModelInfo();
  }

  /**
   * Check if the provider is available.
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }
}

/**
 * Create a default LLM adaptation layer.
 * Uses OpenAI by default if available, falls back to Qwen.
 */
export async function createDefaultAdaptationLayer(): Promise<LLMAdaptationLayer> {
  // Try OpenAI first (for testing/fallback)
  const { OpenAIProvider } = await import('../providers/openai-provider');
  const openai = new OpenAIProvider();

  if (await openai.isAvailable()) {
    console.log('[LLMAdaptation] Using OpenAI provider');
    return new LLMAdaptationLayer(openai);
  }

  // Fall back to Qwen
  const { QwenProvider } = await import('../providers/qwen-provider');
  const qwen = new QwenProvider();

  if (await qwen.isAvailable()) {
    console.log('[LLMAdaptation] Using Qwen provider');
    return new LLMAdaptationLayer(qwen);
  }

  throw new Error('No LLM provider available. Set OPENAI_API_KEY or configure Qwen endpoint.');
}
