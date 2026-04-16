/**
 * useAnchorData Hook
 *
 * Wires all engines together for the Anchor screen:
 * 1. Query anchor entities via CrudService (today or yesterday based on anchor type)
 * 2. Fetch related data (JOIN)
 * 3. Resolve card_display templates via Template Engine
 * 4. Compute derived values + run business rules
 * 5. Return display-ready card data
 *
 * Supports anchor types: day_schedule, yesterday_summary, upcoming_project, active_list
 */

import { useMemo } from 'react';
import { useSpec } from '../core/context/SpecContext';
import { resolveTemplate } from '../engines/template-engine';
import { evaluateComputedFields } from '../engines/computed-field-engine';
import { evaluateRules, filterWarningsByLocation, Warning } from '../engines/business-rules-engine';
import { toTableName, q } from '../data/query-builder';

export interface AnchorCard {
  id: number;
  title: string;
  subtitle: string;
  time: string;
  warningText: string | null;
  warnings: Warning[];
  rawData: Record<string, any>;
  relatedData: Record<string, Record<string, any>>;
}

export interface AnchorData {
  greeting: string;
  dateLabel: string;
  cards: AnchorCard[];
  emptyMessage: string;
  emptyAction: string | null;
  stats: { label: string; value: number | string }[];
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Map anchor type to SQLite date offset for the query.
 */
function getDateOffset(anchorType: string): string | undefined {
  switch (anchorType) {
    case 'yesterday_summary':
      return '-1 day';
    case 'day_schedule':
    default:
      return undefined; // today (no offset)
  }
}

export function useAnchorData(): AnchorData | null {
  const { spec, db, crud } = useSpec();

  return useMemo(() => {
    if (!spec || !db || !crud) return null;

    const anchor = spec.anchor;
    const anchorEntity = spec.entities.find((e) => e.name === anchor.entity);
    if (!anchorEntity) return null;

    // Find the belongs_to relationship for related data
    const belongsTo = anchorEntity.relationships.find((r) => r.type === 'belongs_to');
    const joinTarget = belongsTo ? toTableName(belongsTo.target) : undefined;
    const joinFK = belongsTo?.foreign_key;

    // Date offset based on anchor type
    const dateOffset = getDateOffset(anchor.type);

    // Query entities (today for day_schedule, yesterday for yesterday_summary)
    const dateField = anchor.card_display.time_field;
    let rawEntities: Record<string, any>[];

    // If no date field, treat as active_list regardless of anchor.type
    const effectiveType = dateField ? anchor.type : 'active_list';

    switch (effectiveType) {
      case 'upcoming_project': {
        const today = new Date().toISOString().split('T')[0];
        const weekLater = new Date();
        weekLater.setDate(weekLater.getDate() + 7);
        const weekLaterStr = weekLater.toISOString().split('T')[0];
        rawEntities = crud.list(anchor.entity, {
          filters: [
            { field: dateField!, op: '>=', value: today },
            { field: dateField!, op: '<', value: weekLaterStr },
          ],
          orderBy: dateField!,
          orderDir: 'ASC',
        });
        break;
      }
      case 'active_list': {
        rawEntities = crud.list(anchor.entity, {
          orderBy: 'updated_at',
          orderDir: 'DESC',
        });
        break;
      }
      default: {
        rawEntities = crud.anchorQuery(dateField!, dateField!, joinTarget, joinFK, dateOffset);
        break;
      }
    }

    // Batch fetch all related entities to avoid N+1 queries
    let relatedEntitiesMap = new Map<number, Record<string, any>>();
    if (belongsTo) {
      const fkIds = rawEntities
        .map((e) => e[belongsTo.foreign_key])
        .filter((id): id is number => id != null);
      const uniqueFkIds = [...new Set(fkIds)];
      relatedEntitiesMap = crud.readMany(belongsTo.target, uniqueFkIds);
    }

    // Build cards
    const cards: AnchorCard[] = rawEntities.map((entity) => {
      // Build related data for template resolution (using pre-fetched batch)
      const relatedMap: Record<string, Record<string, any>> = {};
      if (belongsTo && entity[belongsTo.foreign_key]) {
        const relatedEntity = relatedEntitiesMap.get(entity[belongsTo.foreign_key]);
        if (relatedEntity) {
          relatedMap[belongsTo.target.toLowerCase()] = relatedEntity;
        }
      }

      // Resolve templates
      const title = resolveTemplate(anchor.card_display.title, entity, relatedMap);
      const subtitle = resolveTemplate(anchor.card_display.subtitle, entity, relatedMap);

      // Time display — extract HH:MM from datetime field (if available)
      const rawTime = dateField ? (entity[dateField] ?? '') : '';
      const time = typeof rawTime === 'string' && rawTime.includes('T')
        ? rawTime.split('T')[1]?.substring(0, 5) ?? rawTime
        : rawTime;

      // Warning handling
      let warningText: string | null = null;
      let allWarnings: Warning[] = [];

      if (belongsTo && anchor.card_display.warning_field) {
        const relatedType = belongsTo.target;
        const relatedId = entity[belongsTo.foreign_key];

        if (relatedId) {
          const relatedEntityData = relatedMap[belongsTo.target.toLowerCase()];
          if (relatedEntityData) {
            // Compute fields for the related entity
            const computed = evaluateComputedFields(relatedType, relatedId, spec, db, relatedEntityData);

            // Resolve warning template
            if (anchor.card_display.warning_template) {
              const warningFieldPath = anchor.card_display.warning_field;
              const [wEntity, wField] = warningFieldPath.includes('.')
                ? warningFieldPath.split('.')
                : [null, warningFieldPath];

              let warningValue: any;
              if (wEntity) {
                warningValue = computed[wField] ?? relatedEntityData[wField];
              } else {
                warningValue = entity[wField];
              }

              if (warningValue && warningValue > 0) {
                warningText = resolveTemplate(
                  anchor.card_display.warning_template,
                  entity,
                  { ...relatedMap, [belongsTo.target.toLowerCase()]: { ...relatedEntityData, ...computed } }
                );
              }
            }

            // Run business rules
            const computed2 = evaluateComputedFields(relatedType, relatedId, spec, db, relatedEntityData);
            allWarnings = evaluateRules(relatedType, relatedEntityData, computed2, spec, relatedMap);
            allWarnings = filterWarningsByLocation(allWarnings, 'card');
          }
        }
      }

      return {
        id: entity.id,
        title,
        subtitle,
        time: typeof time === 'string' ? time : String(time),
        warningText,
        warnings: allWarnings,
        rawData: entity,
        relatedData: relatedMap,
      };
    });

    // Greeting
    const greeting = resolveTemplate(anchor.greeting_template, {
      time_of_day: getTimeOfDay(),
      user_name: spec.meta.name,
    });

    // Stats — generic approach based on anchor type
    const anchorTable = q(toTableName(anchor.entity));
    const dateFn = dateOffset ? `date('now', '${dateOffset}')` : `date('now')`;

    let targetCount: { cnt: number } | null;
    let weekCount: { cnt: number } | null;

    if (effectiveType === 'active_list') {
      targetCount = db.getFirst<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${anchorTable} WHERE archived = 0`
      );
      weekCount = targetCount;
    } else if (effectiveType === 'upcoming_project') {
      const todayStr = new Date().toISOString().split('T')[0];
      const weekLaterStr2 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      targetCount = db.getFirst<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${anchorTable} WHERE archived = 0 AND date(${dateField}) >= ? AND date(${dateField}) < ?`,
        [todayStr, weekLaterStr2]
      );
      weekCount = targetCount;
    } else {
      targetCount = db.getFirst<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${anchorTable} WHERE archived = 0 AND date(${dateField}) = ${dateFn}`
      );

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weekCount = db.getFirst<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${anchorTable} WHERE archived = 0 AND date(${dateField}) >= ? AND date(${dateField}) <= ?`,
        [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
      );
    }

    // Sum of amount field (only if anchor entity has a currency field named 'amount')
    const hasCurrencyAmount = anchorEntity.fields.some(
      (f) => f.name === 'amount' && (f.type === 'currency' || f.type === 'number')
    );
    const targetSum = hasCurrencyAmount && dateField
      ? db.getFirst<{ total: number }>(
          `SELECT COALESCE(SUM(amount), 0) as total FROM ${anchorTable} WHERE archived = 0 AND date(${dateField}) = ${dateFn}`
        )
      : hasCurrencyAmount
      ? db.getFirst<{ total: number }>(
          `SELECT COALESCE(SUM(amount), 0) as total FROM ${anchorTable} WHERE archived = 0`
        )
      : null;

    const stats = anchor.summary.stats.map((stat) => {
      // Generic stat query matching
      if (stat.query === 'today_class_count' || stat.query === 'yesterday_sale_count') {
        return { label: stat.label, value: targetCount?.cnt ?? 0 };
      }
      if (stat.query === 'week_class_count') {
        return { label: stat.label, value: weekCount?.cnt ?? 0 };
      }
      if (stat.query === 'yesterday_total_amount' || stat.query === 'today_total_amount') {
        return { label: stat.label, value: `Rs.${targetSum?.total ?? 0}` };
      }
      return { label: stat.label, value: 0 };
    });

    return {
      greeting,
      dateLabel: anchor.date_label,
      cards,
      emptyMessage: anchor.empty_state.message,
      emptyAction: anchor.empty_state.action ?? null,
      stats,
    };
  }, [spec, db, crud]);
}
