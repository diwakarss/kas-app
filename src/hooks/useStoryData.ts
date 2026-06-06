/**
 * Story Data Hook for KAS App JSON Renderer.
 *
 * Fetches and transforms all data needed for the Story screen:
 * stats card, coming up, timeline events, origin, context, warnings.
 */

import { useMemo } from "react";
import { useSpec } from "../core/context/SpecContext";
import { resolveTemplate } from "../engines/template-engine";
import { evaluateComputedFields } from "../engines/computed-field-engine";
import {
  evaluateRules,
  filterWarningsByLocation,
  Warning,
} from "../engines/business-rules-engine";
import { toTableName, StoryEventSource } from "../data/query-builder";
import { resolveColor } from "../core/theme/tokens";
import { humanizeDateStrings } from "../lib/format-dates";

export interface TimelineEventData {
  id: number;
  sourceEntity: string;
  eventType: string;
  display: string;
  iconColor: string;
  sortDate: string;
  rawData: Record<string, any>;
}

export interface StoryData {
  entity: Record<string, any>;
  entityType: string;
  entityDef: any;
  statsCard: { label: string; value: string }[];
  comingUp: { display: string; id: number; sortDate: string }[];
  events: TimelineEventData[];
  origin: string;
  context: string;
  warnings: Warning[];
  hasMore: boolean;
  totalLoaded: number;
}

const PAGE_SIZE = 50;

export function useStoryData(
  entityType: string,
  entityId: number,
  page: number = 0,
): StoryData | null {
  const { spec, db, crud } = useSpec();

  return useMemo(() => {
    if (!spec || !db || !crud) return null;

    const entityDef = spec.entities.find((e) => e.name === entityType);
    if (!entityDef) return null;

    const entity = crud.read(entityType, entityId);
    if (!entity) return null;

    const storyConfig = spec.story_events?.[entityType];
    // If no story config exists, create a minimal view with just entity data
    const hasStoryConfig = !!storyConfig;

    // Related data for template resolution
    const relatedMap: Record<string, Record<string, any>> = {};
    for (const rel of entityDef.relationships) {
      if (rel.type === "belongs_to" && entity[rel.foreign_key]) {
        const related = crud.read(rel.target, entity[rel.foreign_key]);
        if (related) relatedMap[rel.target.toLowerCase()] = related;
      }
    }

    // Computed fields
    const computed = evaluateComputedFields(
      entityType,
      entityId,
      spec,
      db,
      entity,
    );
    const combinedData = { ...entity, ...computed };

    // Stats card (default to entity name if no config). Date-shaped values
    // get humanized so a leaf-entity stat like "{schedule}" renders
    // "Apr 28, 2026, 9:00 AM" instead of the raw ISO string. When the spec
    // provides a separate value template, render label + value as distinct
    // strings; otherwise fall back to label-only (so StatsCard doesn't show
    // the same line twice).
    const statsCard = (storyConfig?.stats_card || [{ label: "{name}" }]).map(
      (item: any) => {
        const label = humanizeDateStrings(
          resolveTemplate(item.label, combinedData, relatedMap),
        );
        const value = item.value
          ? humanizeDateStrings(
              resolveTemplate(item.value, combinedData, relatedMap),
            )
          : label;
        return { label, value };
      },
    );

    // Coming up
    const comingUp: { display: string; id: number; sortDate: string }[] = [];
    if (storyConfig?.coming_up) {
      const cu = storyConfig.coming_up;
      const now = new Date().toISOString();
      const cuEntityDef0 = spec.entities.find((e) => e.name === cu.source);
      const cuDateField =
        cuEntityDef0?.fields.find(
          (f) => f.type === "datetime" || f.type === "date",
        )?.name ?? "created_at";
      const cuResults = crud.list(cu.source, {
        filters: [
          { field: cu.relationship, op: "=", value: entityId },
          { field: cuDateField, op: ">=", value: now },
        ],
        orderBy: cuDateField,
        orderDir: cu.sort === "asc" ? "ASC" : "DESC",
        limit: 5,
      });
      for (const row of cuResults) {
        const cuRelated: Record<string, Record<string, any>> = {};
        const cuEntityDef = spec.entities.find((e) => e.name === cu.source);
        if (cuEntityDef) {
          for (const rel of cuEntityDef.relationships) {
            if (rel.type === "belongs_to" && row[rel.foreign_key]) {
              const r = crud.read(rel.target, row[rel.foreign_key]);
              if (r) cuRelated[rel.target.toLowerCase()] = r;
            }
          }
        }
        comingUp.push({
          display: resolveTemplate(cu.display, row, cuRelated),
          id: row.id,
          sortDate: row[cuDateField] || row.created_at,
        });
      }
    }

    // Story events (paginated) - use empty array if no config
    // Filter out malformed event configs that are missing required fields
    const storyEvents = (storyConfig?.events || []).filter(
      (ev) => ev.source && ev.relationship && ev.type,
    );
    const sources: StoryEventSource[] = storyEvents.map((ev) => {
      const srcDef = spec.entities.find((e) => e.name === ev.source);
      const srcDateField =
        srcDef?.fields.find((f) => f.type === "datetime" || f.type === "date")
          ?.name ?? "created_at";
      return {
        sourceTable: toTableName(ev.source),
        relationship: ev.relationship,
        dateField: srcDateField,
        filter: ev.filter
          ? { field: ev.filter.field, value: ev.filter.value }
          : undefined,
        eventType: ev.type,
      };
    });

    const rawEvents = crud.storyEvents(
      sources,
      entityId,
      PAGE_SIZE * (page + 1),
      0,
    );
    const events: TimelineEventData[] = rawEvents.map((row) => {
      const eventConfig = storyEvents.find(
        (ev) =>
          toTableName(ev.source) === row._source_entity &&
          ev.type === row._event_type,
      );

      const evRelated: Record<string, Record<string, any>> = {};
      const srcEntityDef = spec.entities.find(
        (e) => e.name.toLowerCase() === row._source_entity,
      );
      if (srcEntityDef) {
        for (const rel of srcEntityDef.relationships) {
          if (rel.type === "belongs_to" && row[rel.foreign_key]) {
            const r = crud.read(rel.target, row[rel.foreign_key]);
            if (r) evRelated[rel.target.toLowerCase()] = r;
          }
        }
      }

      const display = eventConfig
        ? resolveTemplate(eventConfig.display, row, evRelated)
        : `${row._event_type}`;
      const iconColor = eventConfig
        ? resolveColor(eventConfig.icon_color)
        : resolveColor("mist");

      return {
        id: row.id,
        sourceEntity: row._source_entity,
        eventType: row._event_type,
        display,
        iconColor,
        sortDate: row._sort_date || "",
        rawData: row,
      };
    });

    // Origin + Context (provide defaults if no config)
    const originTemplate =
      storyConfig?.origin?.display ||
      storyConfig?.origin ||
      "Created on {created_at}";
    const contextTemplate =
      storyConfig?.context?.display ||
      storyConfig?.context ||
      entityDef.display_name;
    const origin = humanizeDateStrings(
      resolveTemplate(
        typeof originTemplate === "string" ? originTemplate : "",
        combinedData,
        relatedMap,
      ),
    );
    const context = humanizeDateStrings(
      resolveTemplate(
        typeof contextTemplate === "string" ? contextTemplate : "",
        combinedData,
        relatedMap,
      ),
    );

    // Warnings
    let warnings = evaluateRules(
      entityType,
      entity,
      computed,
      spec,
      relatedMap,
    );
    warnings = filterWarningsByLocation(warnings, "story");

    return {
      entity,
      entityType,
      entityDef,
      statsCard,
      comingUp,
      events,
      origin,
      context,
      warnings,
      hasMore: rawEvents.length === PAGE_SIZE * (page + 1),
      totalLoaded: events.length,
    };
  }, [spec, db, crud, entityType, entityId, page]);
}
