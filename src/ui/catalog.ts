/**
 * KAS Component Catalog
 *
 * Defines the Zod-validated component schemas and action definitions
 * that constrain what the LLM can generate. This is the single source
 * of truth: the renderer, the prompt, and the validator all derive
 * from this catalog.
 */

import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react-native/schema';
import { standardComponentDefinitions } from '@json-render/react-native/catalog';
import { z } from 'zod';

export const catalog = defineCatalog(schema, {
  components: {
    ...standardComponentDefinitions,

    // ── KAS Custom Components ──────────────────────────────

    EntityCard: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable().default(null),
        time: z.string().nullable().default(null),
        warningText: z.string().nullable().default(null),
        entityType: z.string(),
        entityId: z.number(),
      }),
      slots: [],
      description:
        'Card displaying an entity record with title, subtitle, time, and optional warning badge. ' +
        'Always 20px horizontal margin, 12px bottom margin, minimum touch target 48px height. ' +
        'Warning badge uses ember color.',
    },

    TimelineEvent: {
      props: z.object({
        display: z.string(),
        iconColor: z.string().default('stream'),
        sortDate: z.string(),
        isLast: z.boolean().default(false),
      }),
      slots: [],
      description:
        'A single event in a timeline with colored dot and connector line. ' +
        'iconColor must be a design token: bloom, stream, mist, ember.',
    },

    StatsCard: {
      props: z.object({
        items: z.array(
          z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()]).nullable(),
          }),
        ),
      }),
      slots: [],
      description: 'Horizontal stats display showing label-value pairs.',
    },

    Greeting: {
      props: z.object({
        greeting: z.string(),
        dateLabel: z.string(),
        nextUp: z.string().nullable().default(null),
      }),
      slots: [],
      description: 'Welcome greeting heading with date label and optional next-up hint.',
    },

    SummaryStats: {
      props: z.object({
        stats: z.array(
          z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()]),
            trend: z
              .object({
                direction: z.enum(['up', 'down', 'flat']),
                label: z.string(),
              })
              .nullable()
              .default(null),
          }),
        ),
      }),
      slots: [],
      description: 'Summary statistics bar shown on the anchor (home) screen. Stats may include a trend delta vs last week.',
    },

    ComingUpCard: {
      props: z.object({
        display: z.string(),
        sortDate: z.string(),
      }),
      slots: [],
      description: 'Card showing a single upcoming scheduled item with date.',
    },

    WarningBadge: {
      props: z.object({
        text: z.string(),
        severity: z.enum(['info', 'warning', 'urgent']).default('warning'),
      }),
      slots: [],
      description:
        'Colored badge showing a warning or alert. Uses ember color for warning/urgent, stream for info.',
    },

    FieldRenderer: {
      props: z.object({
        fieldType: z.enum([
          'text', 'number', 'currency', 'phone', 'email',
          'choice', 'date', 'datetime', 'time', 'toggle',
          'duration', 'note', 'image',
        ]),
        value: z.unknown().nullable(),
        label: z.string(),
        required: z.boolean().default(false),
        placeholder: z.string().nullable().default(null),
        prefix: z.string().nullable().default(null),
        suffix: z.string().nullable().default(null),
        options: z.array(z.string()).nullable().default(null),
        allowCustom: z.boolean().default(false),
      }),
      slots: [],
      description:
        'Renders an input field based on type. Supports text, number, currency, phone, email, ' +
        'choice (dropdown/picker), date, datetime, time, toggle, duration, note, and image.',
    },

    FloatingActions: {
      props: z.object({
        actions: z.array(
          z.object({
            label: z.string(),
            entityType: z.string(),
            icon: z.string().default('+'),
          }),
        ),
      }),
      slots: [],
      description: 'Floating action button with expandable menu for adding new entity records.',
    },

    EmptyState: {
      props: z.object({
        message: z.string(),
        actionLabel: z.string().nullable().default(null),
        actionEntityType: z.string().nullable().default(null),
      }),
      slots: [],
      description: 'Empty state display with message and optional action button to create a record.',
    },

    SectionHeader: {
      props: z.object({
        title: z.string(),
        count: z.number().nullable().default(null),
      }),
      slots: [],
      description: 'Section header with title and optional item count.',
    },

    MonthGrid: {
      props: z.object({
        entityType: z.string(),
        dateField: z.string(),
        displayTemplate: z.string(),
      }),
      slots: [],
      description: 'Calendar month grid showing entity records on their dates.',
    },

    DayDetail: {
      props: z.object({
        date: z.string(),
        items: z.array(
          z.object({
            display: z.string(),
            entityType: z.string(),
            entityId: z.number(),
          }),
        ),
      }),
      slots: [],
      description: 'Day detail view showing all items for a selected calendar date.',
    },

    StepProgress: {
      props: z.object({
        currentStep: z.number(),
        totalSteps: z.number(),
        label: z.string().nullable().default(null),
      }),
      slots: [],
      description: 'Progress indicator showing current step in a multi-step add flow.',
    },

    EntityPicker: {
      props: z.object({
        options: z.array(z.record(z.string(), z.unknown())),
        entityDisplayName: z.string(),
        value: z.number().nullable().default(null),
      }),
      slots: [],
      description: 'Picker for selecting an existing entity record (FK resolution). Shows a list of available entities.',
    },

    CardGrid: {
      props: z.object({}),
      slots: ['default'],
      description:
        'Responsive card layout. On phones (<768px) renders a single column. On tablets renders a 2-column grid.',
    },

    DetailRow: {
      props: z.object({
        label: z.string(),
        value: z.string(),
      }),
      slots: [],
      description:
        'Label/value row used on the Story screen to surface an entity field. Label left (mist), value right (clay).',
    },
  },

  actions: {
    navigate: {
      params: z.object({
        screen: z.enum(['Story', 'AddFlow', 'Calendar', 'Anchor']),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        preFill: z.record(z.string(), z.unknown()).optional(),
      }),
      description: 'Navigate to a screen. Story and AddFlow require entityType.',
    },
    addEntity: {
      params: z.object({
        entityType: z.string(),
        preFill: z.record(z.string(), z.unknown()).optional(),
      }),
      description: 'Open the add flow for an entity type with optional pre-filled values.',
    },
    archiveEntity: {
      params: z.object({
        entityType: z.string(),
        entityId: z.number(),
      }),
      description: 'Archive (soft delete) an entity record.',
    },
    search: {
      params: z.object({
        query: z.string(),
        entities: z.array(z.string()).optional(),
      }),
      description: 'Execute a search across one or more entity types using FTS5.',
    },
    addFlowNext: {
      params: z.object({}),
      description: 'Advance to the next step in the add flow, or submit if on the last step.',
    },
    addFlowBack: {
      params: z.object({}),
      description: 'Go back to the previous step in the add flow.',
    },
    addFlowSkip: {
      params: z.object({}),
      description: 'Skip the current optional step in the add flow.',
    },
  },
});

/** All KAS custom component names (excludes standard json-render components) */
export const kasComponentNames = [
  'EntityCard', 'TimelineEvent', 'StatsCard', 'Greeting', 'SummaryStats',
  'ComingUpCard', 'WarningBadge', 'FieldRenderer', 'FloatingActions',
  'EmptyState', 'SectionHeader', 'MonthGrid', 'DayDetail', 'StepProgress', 'EntityPicker',
  'CardGrid', 'DetailRow',
] as const;

/** All KAS action names */
export const kasActionNames = ['navigate', 'addEntity', 'archiveEntity', 'search', 'addFlowNext', 'addFlowBack', 'addFlowSkip'] as const;
