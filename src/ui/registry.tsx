/**
 * KAS Component Registry
 *
 * Maps catalog component definitions to React Native component implementations.
 * Each component receives typed props from json-render's defineRegistry and
 * delegates to the existing KAS component implementations.
 *
 * Standard layout components (Container, Row, Column, etc.) are provided by
 * @json-render/react-native at runtime. Only custom KAS components need
 * explicit implementations here.
 */

import React from 'react';
import { defineRegistry } from '@json-render/react-native';
import { catalog } from './catalog';
import { useFieldChange } from './FieldChangeContext';

// Import existing component implementations
import EntityCardComponent from '../components/EntityCard';
import GreetingComponent from '../components/Greeting';
import EmptyStateComponent from '../components/EmptyState';
import TimelineEventComponent from '../components/TimelineEvent';
import StatsCardComponent from '../components/StatsCard';
import SummaryStatsComponent from '../components/SummaryStats';
import ComingUpCardComponent from '../components/ComingUpCard';
import WarningBadgeComponent from '../components/WarningBadge';
import FloatingActionsComponent from '../components/FloatingActions';
import FieldRendererComponent from '../components/FieldRenderer';
import SectionHeaderComponent from '../components/SectionHeader';
import MonthGridComponent from '../components/MonthGrid';
import DayDetailComponent from '../components/DayDetail';
import StepProgressComponent from '../components/StepProgress';
import EntityPickerComponent from '../components/EntityPicker';

// Wrapper components that need hooks must be defined as named functions
function FieldRendererWrapper({ props }: any) {
  const onChange = useFieldChange();
  return (
    <FieldRendererComponent
      field={{
        name: '',
        display_name: props.label,
        type: props.fieldType,
        required: props.required,
        searchable: false,
        placeholder: props.placeholder,
        prefix: props.prefix,
        suffix: props.suffix,
        options: props.options,
        allow_custom: props.allowCustom,
      }}
      value={props.value}
      onChange={onChange}
    />
  );
}

function EntityPickerWrapper({ props }: any) {
  const onChange = useFieldChange();
  return (
    <EntityPickerComponent
      options={props.options ?? []}
      entityDisplayName={props.entityDisplayName}
      value={props.value}
      onChange={onChange}
    />
  );
}

// Custom KAS component implementations.
// Standard components (Container, Row, Column, ScrollContainer, etc.)
// are provided by @json-render/react-native at runtime and don't need
// explicit implementations here. We cast to satisfy TypeScript since
// defineRegistry merges these with the built-in standard components.
const kasComponents = {
  EntityCard: ({ props, emit }: any) => (
    <EntityCardComponent
      title={props.title}
      subtitle={props.subtitle}
      time={props.time}
      warningText={props.warningText}
      onPress={() => emit('press')}
    />
  ),

  Greeting: ({ props }: any) => (
    <GreetingComponent
      greeting={props.greeting}
      dateLabel={props.dateLabel}
    />
  ),

  EmptyState: ({ props, emit }: any) => (
    <EmptyStateComponent
      message={props.message}
      action={props.actionLabel}
      onAction={() => emit('press')}
    />
  ),

  TimelineEvent: ({ props }: any) => (
    <TimelineEventComponent
      display={props.display}
      iconColor={props.iconColor}
      sortDate={props.sortDate}
      isLast={props.isLast}
    />
  ),

  StatsCard: ({ props }: any) => (
    <StatsCardComponent items={props.items} />
  ),

  SummaryStats: ({ props }: any) => (
    <SummaryStatsComponent stats={props.stats} />
  ),

  ComingUpCard: ({ props }: any) => (
    <ComingUpCardComponent
      display={props.display}
      sortDate={props.sortDate}
    />
  ),

  WarningBadge: ({ props }: any) => (
    <WarningBadgeComponent
      warning={{ message: props.text, severity: props.severity || 'warning' } as any}
    />
  ),

  FloatingActions: () => (
    <FloatingActionsComponent />
  ),

  FieldRenderer: FieldRendererWrapper,
  EntityPicker: EntityPickerWrapper,

  SectionHeader: ({ props }: any) => (
    <SectionHeaderComponent
      title={props.title}
      count={props.count}
    />
  ),

  MonthGrid: ({ props }: any) => (
    <MonthGridComponent
      year={props.year ?? new Date().getFullYear()}
      month={props.month ?? new Date().getMonth() + 1}
      events={props.events ?? {}}
      selectedDate={props.selectedDate ?? null}
      onSelectDate={props.onSelectDate ?? (() => {})}
    />
  ),

  DayDetail: ({ props }: any) => (
    <DayDetailComponent
      date={props.date}
      events={props.items ?? []}
      onEventPress={() => {}}
    />
  ),

  StepProgress: ({ props }: any) => (
    <StepProgressComponent
      current={props.currentStep}
      total={props.totalSteps}
    />
  ),
};

export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: kasComponents as any,

  actions: {
    navigate: async (params) => {
      console.log('[KAS Registry] navigate action:', params);
    },
    addEntity: async (params) => {
      console.log('[KAS Registry] addEntity action:', params);
    },
    archiveEntity: async (params) => {
      console.log('[KAS Registry] archiveEntity action:', params);
    },
    search: async (params) => {
      console.log('[KAS Registry] search action:', params);
    },
    addFlowNext: async () => {
      console.log('[KAS Registry] addFlowNext action');
    },
    addFlowBack: async () => {
      console.log('[KAS Registry] addFlowBack action');
    },
    addFlowSkip: async () => {
      console.log('[KAS Registry] addFlowSkip action');
    },
  },
});
