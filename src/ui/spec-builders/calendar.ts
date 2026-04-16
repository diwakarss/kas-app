/**
 * Calendar Screen Spec Builder
 *
 * Converts calendar hook data into a json-render {root, elements} spec.
 * Shows: MonthGrid → DayDetail (when a date is selected)
 */

import type { Spec } from '@json-render/core';
import type { CalendarData, CalendarDayEvent } from '../../hooks/useCalendarData';
import type { KASAppSpecV2 } from '../../core/types/kas-spec-v2';
import { catalog } from '../catalog';

export function buildCalendarSpec(calendarData: CalendarData, appSpec: KASAppSpecV2): Spec {
  const elements: Record<string, any> = {};
  const rootChildren: string[] = [];
  const cal = appSpec.ui_hints.calendar;

  // Month grid
  elements['month-grid'] = {
    type: 'MonthGrid',
    props: {
      entityType: cal.entity,
      dateField: cal.date_field,
      displayTemplate: cal.display,
    },
    children: [],
  };
  rootChildren.push('month-grid');

  // Day detail (if a date is selected)
  if (calendarData.selectedDate && calendarData.selectedEvents.length > 0) {
    elements['day-detail'] = {
      type: 'DayDetail',
      props: {
        date: calendarData.selectedDate,
        items: calendarData.selectedEvents.map((ev) => ({
          display: ev.display,
          entityType: ev.entityType,
          entityId: ev.id,
        })),
      },
      children: [],
    };
    rootChildren.push('day-detail');
  } else if (calendarData.selectedDate) {
    elements['empty-day'] = {
      type: 'EmptyState',
      props: {
        message: `No ${cal.entity.toLowerCase()}s on this day`,
        actionLabel: `Add ${cal.entity}`,
        actionEntityType: cal.entity,
      },
      children: [],
    };
    rootChildren.push('empty-day');
  }

  // Floating action
  elements['floating-actions'] = {
    type: 'FloatingActions',
    props: {
      actions: [
        {
          label: appSpec.entities.find((e) => e.name === cal.entity)?.display_name ?? cal.entity,
          entityType: cal.entity,
          icon: '+',
        },
      ],
    },
    children: [],
  };
  rootChildren.push('floating-actions');

  // Root
  elements['root'] = {
    type: 'SafeArea',
    props: { backgroundColor: '#FAF7F2' },
    children: rootChildren,
  };

  const builtSpec: Spec = { root: 'root', elements };

  const validation = catalog.validate(builtSpec);
  if (!validation.success) {
    console.warn('[calendar builder] produced invalid spec:', validation.error);
  }

  return builtSpec;
}
