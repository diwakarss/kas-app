/**
 * useCalendarData Hook for KAS App JSON Renderer.
 *
 * Manages calendar state: current month, events grouped by date,
 * selected date, and event display resolution.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSpec } from '../core/context/SpecContext';
import { resolveTemplate } from '../engines/template-engine';
import { toTableName } from '../data/query-builder';

export interface CalendarDayEvent {
  id: number;
  entityType: string;
  display: string;
  statusColor: string;
  sortDate: string;
  raw: Record<string, any>;
}

export interface CalendarData {
  year: number;
  month: number;
  events: Record<string, CalendarDayEvent[]>;
  selectedDate: string | null;
  selectedEvents: CalendarDayEvent[];
  prevMonth: () => void;
  nextMonth: () => void;
  selectDate: (date: string | null) => void;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  scheduled: 'stream',
  completed: 'bloom',
  rescheduled: 'mist',
  cancelled: 'ember',
};

export function useCalendarData(): CalendarData | null {
  const { spec, crud } = useSpec();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calConfig = spec?.calendar;

  const events = useMemo(() => {
    if (!spec || !crud || !calConfig) return {};

    const entityDef = spec.entities.find(e => e.name === calConfig.entity);
    if (!entityDef) return {};

    const entityTable = toTableName(calConfig.entity);
    const belongsTo = entityDef.relationships.find(r => r.type === 'belongs_to');
    const joinTarget = belongsTo ? toTableName(belongsTo.target) : undefined;
    const joinFK = belongsTo?.foreign_key;

    const rawEvents = crud.calendarEvents(
      calConfig.entity,
      calConfig.date_field,
      year,
      month,
      joinTarget,
      joinFK
    );

    const grouped: Record<string, CalendarDayEvent[]> = {};
    for (const row of rawEvents) {
      const dateVal = row[calConfig.date_field];
      if (!dateVal) continue;

      const dateKey = typeof dateVal === 'string' && dateVal.includes('T')
        ? dateVal.split('T')[0]
        : String(dateVal).substring(0, 10);

      const relatedMap: Record<string, Record<string, any>> = {};
      if (belongsTo && row._related_name) {
        relatedMap[belongsTo.target.toLowerCase()] = { name: row._related_name };
      } else if (belongsTo && row[belongsTo.foreign_key]) {
        const related = crud.read(belongsTo.target, row[belongsTo.foreign_key]);
        if (related) relatedMap[belongsTo.target.toLowerCase()] = related;
      }

      const display = resolveTemplate(calConfig.display || '{name}', row, relatedMap);

      const statusVal = calConfig.color_field ? row[calConfig.color_field] : null;
      const statusColor = statusVal ? (STATUS_COLOR_MAP[statusVal] || 'stream') : 'stream';

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        id: row.id,
        entityType: calConfig.entity,
        display,
        statusColor,
        sortDate: dateVal,
        raw: row,
      });
    }

    return grouped;
  }, [spec, crud, calConfig, year, month]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events[selectedDate] || [];
  }, [events, selectedDate]);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear(y => y - 1);
      setMonth(12);
    } else {
      setMonth(m => m - 1);
    }
    setSelectedDate(null);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear(y => y + 1);
      setMonth(1);
    } else {
      setMonth(m => m + 1);
    }
    setSelectedDate(null);
  }, [month]);

  const selectDate = useCallback((date: string | null) => {
    setSelectedDate(date);
  }, []);

  if (!calConfig) return null;

  return {
    year,
    month,
    events,
    selectedDate,
    selectedEvents,
    prevMonth,
    nextMonth,
    selectDate,
  };
}
