/**
 * Story events normalization.
 *
 * Fixes shape (array → {events}), filters invalid FK references, repairs
 * display templates, infers events for belongs_to targets, ensures every
 * entity has a minimal story block, and surfaces balance_due stats.
 */

import type { Entity, Field } from '../../../core/types/spec';
import { findPrimaryTextField } from './shared';

/** Fix double-brace `{{field}}` → `{field}` recursively on any value. */
function fixTemplateSyntax(obj: any): any {
  if (typeof obj === 'string') {
    let s = obj;
    s = s.replace(/\{\{(\w+)\}\}/g, '{$1}');
    s = s.replace(/\{\{[^}]*\}\}/g, '');
    s = s.replace(/\$\{(\w+)\}/g, '{$1}');
    s = s.replace(/\$\{[^}]+\}/g, '');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  if (Array.isArray(obj)) return obj.map(fixTemplateSyntax);
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) result[k] = fixTemplateSyntax(v);
    return result;
  }
  return obj;
}

/**
 * Infer story_events for entities that are belongs_to targets.
 * If entity X has children pointing at it, story_events[X] should list those children.
 */
function inferStoryEvents(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };
  for (const entity of entities) {
    for (const rel of entity.relationships) {
      if (rel.type === 'belongs_to' && !result[rel.target]) {
        const childEntity = entity;
        const parentEntity = entities.find(e => e.name === rel.target);
        if (!parentEntity) continue;

        const dateField = childEntity.fields.find(f =>
          f.type === 'datetime' || f.type === 'date'
        );

        const childPrimary = findPrimaryTextField(childEntity);
        const parentPrimary = findPrimaryTextField(parentEntity);
        const childPrimaryDef = childEntity.fields.find(f => f.name === childPrimary);
        const needsPrefix = childPrimaryDef && ['date', 'datetime', 'number', 'currency'].includes(childPrimaryDef.type);
        const displayTemplate = needsPrefix ? `${childEntity.display_name}: {${childPrimary}}` : `{${childPrimary}}`;
        console.log(`[normalizeSpec] Inferred story_events for '${rel.target}' from '${childEntity.name}'`);
        result[rel.target] = {
          events: [{
            source: childEntity.name,
            relationship: rel.foreign_key,
            type: childEntity.name.toLowerCase(),
            display: displayTemplate,
            icon_color: 'stream',
          }],
          stats_card: [{ label: `{${parentPrimary}}` }],
          origin: 'Created on {created_at}',
          context: parentEntity.display_name,
          ...(dateField ? {
            coming_up: {
              source: childEntity.name,
              relationship: rel.foreign_key,
              display: `{${childPrimary}}`,
              sort: 'asc',
            },
          } : {}),
        };
      }
    }
  }
  return result;
}

/**
 * Ensure every entity has a story_events entry so the Story screen has
 * something to render — even leaf entities that aren't belongs_to targets.
 */
function ensureStoryEventsForAllEntities(
  existing: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const result = { ...existing };
  for (const entity of entities) {
    if (result[entity.name]) continue;
    const primary = findPrimaryTextField(entity);
    const primaryDef = entity.fields.find(f => f.name === primary);
    const needsPrefix =
      primaryDef &&
      (primary.endsWith('_id') ||
        ['date', 'datetime', 'number', 'currency'].includes(primaryDef.type));
    const statsLabel = needsPrefix
      ? `${entity.display_name}: {${primary}}`
      : `{${primary}}`;
    console.log(`[normalizeSpec] Minimal story_events for leaf entity '${entity.name}'`);
    result[entity.name] = {
      events: [],
      stats_card: [{ label: statsLabel }],
      origin: 'Created on {created_at}',
      context: entity.display_name,
    };
  }
  return result;
}

export function normalizeStoryEventsFormat(
  raw: Record<string, any>,
  entities: Entity[]
): Record<string, any> {
  const fixed: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      console.log(`[normalizeSpec] Fixed story_events.${key}: array → {events: [...]}`);
      fixed[key] = { events: fixTemplateSyntax(value) };
    } else if (value && typeof value === 'object') {
      fixed[key] = fixTemplateSyntax(value);
      if (!fixed[key].events && !fixed[key].stats_card) {
        fixed[key] = { events: [] };
      }
    }
  }

  for (const [key, config] of Object.entries(fixed)) {
    if (!config?.events) continue;
    config.events = config.events.filter((ev: any) => {
      if (!ev.source || !ev.relationship) return false;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: source '${ev.source}' not found`);
        return false;
      }
      const hasFK = srcEntity.fields.some((f: Field) => f.name === ev.relationship);
      if (!hasFK) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' not found on '${ev.source}'`);
        return false;
      }
      const rel = srcEntity.relationships.find((r: any) => r.foreign_key === ev.relationship);
      if (rel && rel.target !== key) {
        console.log(`[normalizeSpec] Removed story_events.${key} event: FK '${ev.relationship}' on '${ev.source}' points to '${rel.target}', not '${key}'`);
        return false;
      }
      return true;
    });

    for (const ev of config.events) {
      if (!ev.display || !ev.source) continue;
      const srcEntity = entities.find(e => e.name === ev.source);
      if (!srcEntity) continue;
      const srcFields = new Set(srcEntity.fields.map((f: Field) => f.name));
      const hasDotRef = /\{[a-zA-Z_]+\.[a-zA-Z_]+\}/.test(ev.display);
      const simplePlaceholders = Array.from((ev.display as string).matchAll(/\{([a-zA-Z_]\w*)\}/g))
        .filter((m: RegExpMatchArray) => !(ev.display as string).includes(m[1] + '.'));
      const hasInvalid = simplePlaceholders.some((m: RegExpMatchArray) => !srcFields.has(m[1]));
      const allFK = simplePlaceholders.length > 0 && simplePlaceholders.every((m: RegExpMatchArray) => m[1].endsWith('_id'));
      if (hasDotRef || hasInvalid || allFK) {
        const primary = findPrimaryTextField(srcEntity);
        const primaryDef = srcEntity.fields.find((f: Field) => f.name === primary);
        const needsPrefix = primaryDef && ['date', 'datetime', 'number', 'currency'].includes(primaryDef.type);
        const fixedDisplay = needsPrefix ? `${srcEntity.display_name}: {${primary}}` : `{${primary}}`;
        console.log(`[normalizeSpec] Fixed story_events.${key} event display '${ev.display}' → '${fixedDisplay}' for source '${ev.source}'`);
        ev.display = fixedDisplay;
      }
    }

    const targetEntity = entities.find(e => e.name === key);
    if (targetEntity && config.events && !config.stats_card) {
      const primary = findPrimaryTextField(targetEntity);
      config.stats_card = [{ label: `{${primary}}` }];
      config.origin = config.origin || 'Created on {created_at}';
      config.context = config.context || targetEntity.display_name;
      if (!config.coming_up) {
        for (const ev of config.events) {
          const srcEntity = entities.find(e => e.name === ev.source);
          const dateField = srcEntity?.fields.find((f: Field) => f.type === 'datetime' || f.type === 'date');
          if (srcEntity && dateField) {
            config.coming_up = {
              source: srcEntity.name,
              relationship: ev.relationship,
              display: ev.display,
              sort: 'asc',
            };
            break;
          }
        }
      }
    }
  }

  const withChildren = inferStoryEvents(fixed, entities);
  return ensureStoryEventsForAllEntities(withChildren, entities);
}

/**
 * For each entity that has a `balance_due` computed field, ensure its
 * story_events.stats_card surfaces the balance so users see it on the
 * Story screen. Idempotent: skips entities whose stats_card already
 * references balance_due.
 */
export function injectBalanceDueStats(
  storyEvents: Record<string, any>,
  computedFields: Record<string, any[]>
): Record<string, any> {
  const result: Record<string, any> = { ...storyEvents };
  for (const [entityName, cfs] of Object.entries(computedFields)) {
    if (!cfs.some((cf: any) => cf.name === 'balance_due')) continue;
    const cfg = result[entityName];
    if (!cfg) continue;
    const existing: any[] = Array.isArray(cfg.stats_card) ? cfg.stats_card : [];
    const alreadyHas = existing.some(
      s => typeof s?.label === 'string' && s.label.includes('{balance_due}')
    );
    if (alreadyHas) continue;
    result[entityName] = {
      ...cfg,
      stats_card: [...existing, { label: 'Balance Due: ${balance_due}' }],
    };
    console.log(`[normalizeSpec] Surfaced balance_due on story_events.${entityName}.stats_card`);
  }
  return result;
}
