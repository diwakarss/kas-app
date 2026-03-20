/**
 * LLM Adaptation Layer
 *
 * Handles prompt engineering and response parsing for spec generation.
 * Provides reusable methods for both fresh generation and spec modification.
 */

import type { LLMProvider, GenerationResult } from '../types/providers';
import type { KASAppSpec } from '../../core/types/spec';

/**
 * System prompt for spec generation.
 */
const SPEC_GENERATION_SYSTEM_PROMPT = `/no_think
You are a business application specification generator. Return ONLY valid JSON, no explanations.

CRITICAL: Follow this EXACT structure. Missing fields will break the app.

{
  "meta": {
    "name": "Business Name",
    "business_type": "type",
    "version": 1,
    "spec_id": "unique-id-here",
    "created_date": "2024-01-01T00:00:00Z",
    "customizations": [],
    "version_history": [{"version": 1, "date": "2024-01-01T00:00:00Z", "source": "generated", "changes": "Initial"}]
  },
  "entities": [
    {
      "name": "Customer",
      "display_name": "Customer",
      "display_name_plural": "Customers",
      "icon": "👤",
      "fields": [
        {"name": "name", "display_name": "Name", "type": "text", "required": true, "searchable": true},
        {"name": "phone", "display_name": "Phone", "type": "phone", "required": false, "searchable": true}
      ],
      "relationships": []
    },
    {
      "name": "Appointment",
      "display_name": "Appointment",
      "display_name_plural": "Appointments",
      "icon": "📅",
      "fields": [
        {"name": "datetime", "display_name": "Date & Time", "type": "datetime", "required": true, "searchable": true},
        {"name": "notes", "display_name": "Notes", "type": "note", "required": false, "searchable": false}
      ],
      "relationships": [
        {"target": "Customer", "type": "belongs_to", "foreign_key": "customer_id", "display_in_story": true}
      ]
    }
  ],
  "anchor": {
    "entity": "Appointment",
    "type": "day_schedule",
    "greeting_template": "Good {time_of_day}",
    "date_label": "today",
    "card_display": {
      "title": "{customer.name}",
      "subtitle": "{notes}",
      "time_field": "datetime",
      "actions": ["edit", "delete"]
    },
    "empty_state": {
      "message": "No appointments today",
      "action": "Add an appointment",
      "fallback_view": "calendar"
    },
    "summary": {
      "stats": [
        {"label": "Today", "query": "today_class_count"},
        {"label": "This Week", "query": "week_class_count"}
      ]
    }
  },
  "story_events": {
    "Customer": {
      "stats_card": [{"label": "{name}"}],
      "coming_up": {
        "entity": "Appointment",
        "relationship": "customer_id",
        "date_field": "datetime",
        "display": "{datetime} - {notes}"
      },
      "events": [
        {"source": "Appointment", "relationship": "customer_id", "type": "scheduled", "display": "{datetime} - {notes}", "icon_color": "stream"}
      ],
      "origin": "Created on {created_at}",
      "context": "Customer profile"
    }
  },
  "add_flows": {
    "Customer": {
      "steps": [
        {"field": "name", "prompt": "Customer name?", "required": true, "keyboard": "default"},
        {"field": "phone", "prompt": "Phone number?", "required": false, "skip_text": "skip", "keyboard": "phone"}
      ]
    },
    "Appointment": {
      "steps": [
        {"field": "customer_id", "prompt": "Select customer", "required": true},
        {"field": "datetime", "prompt": "When?", "required": true, "keyboard": "default"},
        {"field": "notes", "prompt": "Any notes?", "required": false, "skip_text": "skip", "keyboard": "default"}
      ],
      "after_add": {"action": "navigate", "target": "Customer", "text": "View Customer"}
    }
  },
  "search": {
    "entities": ["Customer", "Appointment"],
    "default_entity": "Customer",
    "display": {
      "Customer": "{name} - {phone}",
      "Appointment": "{customer.name} - {datetime}"
    }
  },
  "calendar": {
    "entity": "Appointment",
    "date_field": "datetime",
    "display": "{time} - {customer.name}",
    "color_field": "status"
  },
  "chat_commands": [
    {"pattern": "add customer", "action": {"type": "add", "entity": "Customer"}},
    {"pattern": "add appointment", "action": {"type": "add", "entity": "Appointment"}}
  ],
  "business_rules": [],
  "computed_fields": {
    "Customer": [
      {"name": "appointment_count", "display_name": "Appointments", "type": "count", "source_entity": "Appointment", "relationship": "customer_id"}
    ]
  }
}

RULES:
1. Field types: text, number, currency, phone, email, choice, date, datetime, time, toggle, duration, note, image
2. For "choice" fields, include "choices": ["option1", "option2"]
3. Relationship types: belongs_to (child entity has FK to parent)
4. The anchor entity MUST have a datetime field for scheduling
5. CRITICAL: story_events MUST exist for entities that are belongs_to targets (like Customer)
6. CRITICAL: add_flows steps use "field" (singular), NOT "fields" array. Each step is one field.
7. CRITICAL: search.display and calendar.display are REQUIRED templates
8. CRITICAL: anchor needs card_display, empty_state, and summary sections`;

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
      system_prompt: SPEC_GENERATION_SYSTEM_PROMPT,
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
      system_prompt: SPEC_GENERATION_SYSTEM_PROMPT,
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
