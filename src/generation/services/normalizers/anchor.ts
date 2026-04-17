/**
 * Anchor normalization.
 *
 * Resolves the anchor entity (including dateless / container auto-swaps),
 * builds card title/subtitle (with 3-phase fallback chain), enriches the
 * greeting template, and upgrades default stats labels.
 */

import type { Entity, KASAppSpec } from '../../../core/types/spec';
import {
  findPrimaryTextField,
  findSubtitleField,
  findScheduleDateField,
  validateTemplate,
} from './shared';
import { isContainerEntity, isPersonLikeEntity } from './roles';

export function normalizeAnchor(
  anchor: Partial<KASAppSpec['anchor']> | undefined,
  entities: Entity[]
): KASAppSpec['anchor'] {
  const defaultEntity = entities[0]?.name || 'Item';
  let anchorEntityName = anchor?.entity || defaultEntity;
  let anchorEntity = entities.find(e => e.name === anchorEntityName) || entities[0];
  let anchorType = anchor?.type || 'day_schedule';
  let anchorSwapped = false;

  const needsScheduleSwap =
    anchorEntity &&
    anchorType === 'day_schedule' &&
    !findScheduleDateField(anchorEntity);

  const prefersChildActivity =
    !needsScheduleSwap &&
    anchorEntity &&
    anchorType === 'day_schedule' &&
    (isContainerEntity(anchorEntity) || isPersonLikeEntity(anchorEntity));

  const findActivityChild = (parent: Entity) =>
    entities.find(e =>
      e.name !== parent.name &&
      !isPersonLikeEntity(e) &&
      !isContainerEntity(e) &&
      e.relationships.some(r => r.type === 'belongs_to' && r.target === parent.name) &&
      findScheduleDateField(e) !== null
    );

  if (needsScheduleSwap) {
    const activityEntity = entities.find(e =>
      e.name !== anchorEntity!.name &&
      e.relationships.some(r => r.type === 'belongs_to') &&
      findScheduleDateField(e) !== null
    );
    if (activityEntity) {
      console.log(`[normalizeSpec] Anchor swap: '${anchorEntityName}' (no schedule date) → '${activityEntity.name}' (activity with date)`);
      anchorEntityName = activityEntity.name;
      anchorEntity = activityEntity;
      anchorSwapped = true;
    } else {
      console.log(`[normalizeSpec] Anchor type downgrade: '${anchorEntityName}' has no date and no schedulable child → anchor.type = 'active_list'`);
      anchorType = 'active_list';
    }
  } else if (prefersChildActivity) {
    const activityEntity = findActivityChild(anchorEntity!);
    if (activityEntity) {
      console.log(`[normalizeSpec] Container anchor swap: '${anchorEntityName}' (container/person-like) → '${activityEntity.name}' (recurring activity)`);
      anchorEntityName = activityEntity.name;
      anchorEntity = activityEntity;
      anchorSwapped = true;
    }
  }

  const primaryField = findPrimaryTextField(anchorEntity);
  const dateTimeField = findScheduleDateField(anchorEntity);

  // Phase A: primary is a date and entity belongs_to a parent → use {parent.primary}
  let defaultTitle = `{${primaryField}}`;
  let defaultSubtitle = '';
  if (anchorEntity) {
    const primaryFieldDef = anchorEntity.fields.find(f => f.name === primaryField);
    const primaryIsDate = primaryFieldDef && (primaryFieldDef.type === 'date' || primaryFieldDef.type === 'datetime');

    if (primaryIsDate) {
      const belongsTo = anchorEntity.relationships.find(r => r.type === 'belongs_to');
      if (belongsTo) {
        const parentEntity = entities.find(e => e.name === belongsTo.target);
        if (parentEntity) {
          const parentPrimary = findPrimaryTextField(parentEntity);
          defaultTitle = `{${belongsTo.target.toLowerCase()}.${parentPrimary}}`;
          const subField = findSubtitleField(anchorEntity, primaryField);
          defaultSubtitle = subField ? `{${subField}}` : '';
        }
      }
    }

    // Phase B: belongs_to a person-like parent → flip title to person name
    if (defaultTitle === `{${primaryField}}`) {
      const belongsToRels = anchorEntity.relationships.filter(r => r.type === 'belongs_to');
      for (const bt of belongsToRels) {
        const parent = entities.find(e => e.name === bt.target);
        if (parent && isPersonLikeEntity(parent)) {
          const parentPrimary = findPrimaryTextField(parent);
          defaultTitle = `{${bt.target.toLowerCase()}.${parentPrimary}}`;
          const subField = findSubtitleField(anchorEntity, primaryField);
          defaultSubtitle = subField ? `{${subField}}` : '';
          console.log(`[normalizeSpec] Anchor title Phase B: using person-like ${bt.target}.${parentPrimary}`);
          break;
        }
      }
    }

    // Phase C: primary is weak (FK/choice/number/date). Fall back to any
    // belongs_to parent's primary text. Covers chains like Fitting → Order.
    const primaryIsWeak =
      primaryFieldDef &&
      (primaryField.endsWith('_id') ||
        ['choice', 'number', 'currency', 'date', 'datetime', 'time'].includes(primaryFieldDef.type));
    if (defaultTitle === `{${primaryField}}` && primaryIsWeak) {
      const belongsToRels = anchorEntity.relationships.filter(r => r.type === 'belongs_to');
      for (const bt of belongsToRels) {
        const parent = entities.find(e => e.name === bt.target);
        if (!parent) continue;
        const parentPrimary = findPrimaryTextField(parent);
        const parentPrimaryDef = parent.fields.find(f => f.name === parentPrimary);
        if (!parentPrimaryDef || parentPrimary.endsWith('_id')) continue;
        defaultTitle = `{${bt.target.toLowerCase()}.${parentPrimary}}`;
        const subField = findSubtitleField(anchorEntity, primaryField);
        defaultSubtitle = subField ? `{${subField}}` : '';
        console.log(`[normalizeSpec] Anchor title Phase C: weak primary '${primaryField}' → parent ${bt.target}.${parentPrimary}`);
        break;
      }
    }

    if (!defaultSubtitle && defaultTitle === `{${primaryField}}`) {
      const subField = findSubtitleField(anchorEntity, primaryField);
      if (subField) defaultSubtitle = `{${subField}}`;
    }
  }

  const anchorPlural = anchorEntity?.display_name_plural || anchorEntity?.display_name || 'Items';

  // After a swap, the LLM's original templates were for a different entity.
  // Ignore them and recompute from defaults.
  const rawTitle = !anchorSwapped && anchor?.card_display?.title
    ? anchor.card_display.title
    : defaultTitle;
  const validatedTitle = validateTemplate(rawTitle, anchorEntity);
  const rawSubtitle = !anchorSwapped && anchor?.card_display?.subtitle
    ? anchor.card_display.subtitle
    : defaultSubtitle;
  let validatedSubtitle = validateTemplate(rawSubtitle, anchorEntity);

  const finalTimeField = (!anchorSwapped && anchor?.card_display?.time_field) || dateTimeField?.name || null;

  // Fix: subtitle and time_field pointing at the same field makes the
  // subtitle a duplicate of the time column. Swap to a descriptive field.
  if (finalTimeField && validatedSubtitle === `{${finalTimeField}}`) {
    const alt = findSubtitleField(anchorEntity, finalTimeField);
    if (alt) {
      console.log(`[normalizeSpec] Anchor subtitle collided with time_field '${finalTimeField}' → swapped to '{${alt}}'`);
      validatedSubtitle = `{${alt}}`;
    } else {
      console.log(`[normalizeSpec] Anchor subtitle collided with time_field '${finalTimeField}' and no descriptive field found → cleared subtitle`);
      validatedSubtitle = '';
    }
  }

  // Greeting: ensure business_name is present.
  let greetingTemplate = anchor?.greeting_template || 'Good {time_of_day}, {business_name}';
  if (!greetingTemplate.includes('{business_name}')) {
    greetingTemplate = `${greetingTemplate.replace(/[.!\s]+$/, '')}, {business_name}`;
    console.log(`[normalizeSpec] Greeting template missing {business_name} → appended`);
  }

  // Stats: upgrade generic labels to entity-aware ones.
  const rawStats = anchor?.summary?.stats;
  const isDefaultStats =
    !rawStats ||
    rawStats.length === 0 ||
    (rawStats.length <= 2 &&
      rawStats.every(s =>
        /^(today|this week|week|today's?)$/i.test((s as any).label || '')
      ));

  let enrichedStats = rawStats as Array<{ label: string; query: string }> | undefined;
  if (isDefaultStats) {
    enrichedStats = [
      { label: `${anchorPlural} Today`, query: 'today_count' },
      { label: 'This Week', query: 'week_count' },
    ];
    const hasStatusField = anchorEntity?.fields.some(
      f => f.type === 'choice' && /status|state/i.test(f.name)
    );
    if (hasStatusField) {
      enrichedStats.push({ label: `Active ${anchorPlural}`, query: 'active_count' });
    }
    console.log(`[normalizeSpec] Stats enriched with entity noun '${anchorPlural}'`);
  }

  return {
    entity: anchorEntityName,
    type: anchorType,
    greeting_template: greetingTemplate,
    date_label: anchor?.date_label || 'today',
    card_display: {
      ...anchor?.card_display,
      title: validatedTitle,
      subtitle: validatedSubtitle,
      time_field: finalTimeField,
      actions: anchor?.card_display?.actions || ['edit', 'delete'],
    },
    empty_state: {
      message: anchor?.empty_state?.message || `No ${anchorPlural.toLowerCase()} today`,
      action: anchor?.empty_state?.action || `Add ${anchorEntity?.display_name?.toLowerCase() || 'an item'}`,
      fallback_view: anchor?.empty_state?.fallback_view || 'calendar',
      ...anchor?.empty_state,
    },
    summary: {
      ...anchor?.summary,
      stats: enrichedStats as any,
    },
  } as KASAppSpec['anchor'];
}
