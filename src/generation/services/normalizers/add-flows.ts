/**
 * Add-flow normalization + chat command inference.
 *
 * Fixes add_flows shape, humanizes robotic prompts, marks FK steps as
 * entity_picker, injects missing FK picker steps (so standalone creation
 * works), infers add_flows for entities without one, and wires after_add
 * drill-down. Also infers default chat_commands from entities when the
 * spec ships without any.
 */

import type { Entity } from '../../../core/types/spec';
import { humanize, findScheduleDateField } from './shared';

/** Generate a human-friendly prompt for an add flow step */
function humanizePrompt(fieldName: string, entity: Entity | undefined): string {
  if (fieldName.endsWith('_id') && entity) {
    const rel = entity.relationships.find(r => r.foreign_key === fieldName);
    if (rel) return `Select ${humanize(rel.target).toLowerCase()}`;
    return `Select ${humanize(fieldName)}`;
  }
  const label = humanize(fieldName).toLowerCase();
  return `Enter ${label}`;
}

/**
 * Infer an on-screen keyboard hint from the field type or name so mobile web
 * users get a numeric pad for money, a phone pad for phones, etc. LLM output
 * rarely sets this on individual steps, and fields like `phone` often ship as
 * plain `text` type, so we pattern-match the name too.
 */
function inferKeyboardForField(fieldName: string, fieldType: string | undefined): string | null {
  const t = (fieldType || 'text').toLowerCase();
  if (t === 'number' || t === 'integer' || t === 'currency' || t === 'money') return 'numeric';
  if (t === 'phone') return 'phone-pad';
  if (t === 'email') return 'email-address';
  const n = fieldName.toLowerCase();
  if (/phone|mobile|tel/.test(n)) return 'phone-pad';
  if (/email/.test(n)) return 'email-address';
  if (/zip|postal|amount|price|cost|fee|balance|total|quantity|qty/.test(n)) return 'numeric';
  return null;
}

/**
 * When a field is an `_id` FK with a matching belongs_to relationship,
 * return the step-level picker props. Returns {} for non-FK fields.
 */
function buildEntityPickerProps(
  fieldName: string,
  entity: Entity
): { field_type?: 'entity_picker'; entity_target?: string } {
  if (!fieldName.endsWith('_id')) return {};
  const rel = entity.relationships.find(
    r => r.type === 'belongs_to' && r.foreign_key === fieldName
  );
  if (!rel) return {};
  return { field_type: 'entity_picker', entity_target: rel.target };
}

/** Backfill `field_type: 'entity_picker'` on LLM-emitted steps referencing an FK. */
function markEntityPickerSteps(flow: any, entity: Entity): void {
  if (!flow || !Array.isArray(flow.steps)) return;
  for (const step of flow.steps) {
    if (step.field_type || !step.field) continue;
    const props = buildEntityPickerProps(step.field, entity);
    if (props.field_type) {
      step.field_type = props.field_type;
      step.entity_target = props.entity_target;
    }
  }
}

/**
 * Prepend picker steps for belongs_to FKs not already in the step list.
 * Without this, child entities have no way to set their FK from standalone
 * add. Drill-down still works because useAddFlow hides pre-filled steps.
 */
function injectMissingFKSteps(flow: any, entity: Entity): void {
  if (!flow || !Array.isArray(flow.steps)) return;
  const existingFields = new Set(flow.steps.map((s: any) => s.field));
  const missingFKSteps: any[] = [];
  for (const rel of entity.relationships) {
    if (rel.type !== 'belongs_to') continue;
    if (existingFields.has(rel.foreign_key)) continue;
    missingFKSteps.push({
      field: rel.foreign_key,
      prompt: `Select ${rel.target}`,
      required: true,
      field_type: 'entity_picker',
      entity_target: rel.target,
    });
  }
  if (missingFKSteps.length > 0) {
    flow.steps = [...missingFKSteps, ...flow.steps];
    console.log(
      `[normalizeSpec] Injected ${missingFKSteps.length} FK picker step(s) into '${entity.name}' add_flow`
    );
  }
}

function inferAddFlows(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };

  for (const entity of entities) {
    if (result[entity.name]) {
      markEntityPickerSteps(result[entity.name], entity);
      continue;
    }

    const userFields = entity.fields.filter(f =>
      !['id', 'created_at', 'updated_at', 'archived'].includes(f.name)
    );
    if (userFields.length === 0) continue;

    console.log(`[normalizeSpec] Inferred add_flow for '${entity.name}'`);
    result[entity.name] = {
      steps: userFields.map(f => {
        const kb = inferKeyboardForField(f.name, f.type);
        const required = f.required ?? false;
        return {
          field: f.name,
          prompt: humanizePrompt(f.name, entity),
          required,
          ...(kb ? { keyboard: kb } : {}),
          ...(required ? {} : { skip_text: 'Skip' }),
          ...(buildEntityPickerProps(f.name, entity)),
        };
      }),
    };
  }

  // After-add drill-down: after adding a parent, suggest adding a child
  for (const entity of entities) {
    const flow = result[entity.name];
    if (!flow || flow.after_add) continue;
    const childEntity = entities.find(child =>
      child.name !== entity.name &&
      child.relationships.some(r => r.type === 'belongs_to' && r.target === entity.name)
    );
    if (childEntity) {
      const childRel = childEntity.relationships.find(r => r.type === 'belongs_to' && r.target === entity.name);
      if (childRel) {
        flow.after_add = {
          action: 'suggest',
          target: childEntity.name,
          text: `Add ${childEntity.display_name}`,
          pre_fill: { [childRel.foreign_key]: '{id}' },
        };
      }
    }
  }

  for (const entity of entities) {
    const flow = result[entity.name];
    if (!flow) continue;
    injectMissingFKSteps(flow, entity);
  }

  return result;
}

export function normalizeAddFlowsFormat(
  raw: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const fixed: Record<string, any> = {};

  // Handle LLM returning add_flows as an array instead of object
  const entries = Array.isArray(raw)
    ? raw.map((flow: any) => [flow.entity || `flow_${raw.indexOf(flow)}`, flow])
    : Object.entries(raw);

  for (const [key, value] of entries) {
    if (/^\d+$/.test(key) && value?.entity) {
      const entityName = value.entity;
      console.log(`[normalizeSpec] Fixed add_flows[${key}] → add_flows.${entityName}`);
      fixed[entityName] = value;
      continue;
    }
    if (Array.isArray(value)) {
      console.log(`[normalizeSpec] Fixed add_flows.${key}: array → {steps: [...]}`);
      fixed[key] = { steps: value };
    } else if (value && typeof value === 'object') {
      fixed[key] = value;
    }
  }

  // Humanize robotic prompts + fill in keyboard/skip defaults on LLM-provided flows
  for (const [entityName, flow] of Object.entries(fixed)) {
    if (!flow?.steps) continue;
    const entity = entities.find(e => e.name === entityName);
    for (const step of flow.steps) {
      if (!step.prompt || step.prompt.match(/^Enter\s+\w+_/)) {
        step.prompt = humanizePrompt(step.field, entity);
      }
      if (!step.keyboard && step.field && step.field_type !== 'entity_picker') {
        const isFk = entity?.relationships.some(r => r.type === 'belongs_to' && r.foreign_key === step.field);
        if (!isFk) {
          const entityField = entity?.fields.find(f => f.name === step.field);
          const kb = inferKeyboardForField(step.field, entityField?.type || step.field_type);
          if (kb) step.keyboard = kb;
        }
      }
      if (!step.skip_text) {
        const entityField = entity?.fields.find(f => f.name === step.field);
        const required = step.required ?? entityField?.required ?? false;
        if (!required) step.skip_text = 'Skip';
      }
    }
  }

  return inferAddFlows(fixed, entities);
}

/**
 * Emit default chat_commands when the spec ships without any: `add {entity}`
 * for every entity, plus `show {entity plural} today` for entities with a
 * schedule date field.
 */
export function inferChatCommands(
  existing: any[],
  entities: Entity[]
): any[] {
  if (existing && existing.length > 0) return existing;

  const commands: any[] = [];
  for (const entity of entities) {
    const displayLower = entity.display_name.toLowerCase();
    const pluralLower = entity.display_name_plural.toLowerCase();
    commands.push({
      pattern: `add ${displayLower}`,
      aliases: [`new ${displayLower}`, `create ${displayLower}`],
      action: {
        type: 'addEntity',
        entity: entity.name,
      },
      requires_confirmation: false,
    });
    if (findScheduleDateField(entity)) {
      commands.push({
        pattern: `show ${pluralLower} today`,
        aliases: [`${pluralLower} today`, `today's ${pluralLower}`],
        action: {
          type: 'navigate',
          entity: entity.name,
        },
        requires_confirmation: false,
      });
    }
  }

  if (commands.length > 0) {
    console.log(`[normalizeSpec] Inferred ${commands.length} chat_commands from ${entities.length} entities`);
  }

  return commands;
}
