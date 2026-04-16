/**
 * Story Screen Spec Builder
 *
 * Converts story hook data into a json-render {root, elements} spec.
 * Element order: Header → StatsCard → Warnings → ComingUp → SectionHeader → TimelineEvents → Footer
 */

import type { Spec } from '@json-render/core';
import type { StoryData, TimelineEventData } from '../../hooks/useStoryData';

export function buildStorySpec(storyData: StoryData): Spec {
  const elements: Record<string, any> = {};
  const rootChildren: string[] = [];

  const entityName = storyData.entity.name || storyData.entity.topic || storyData.entityType || '';
  const entityIcon = storyData.entityDef.icon || '';

  // Header section
  elements['header'] = {
    type: 'Column',
    props: { gap: 4, padding: 20 },
    children: ['entity-icon', 'entity-name', 'entity-type', 'context'],
  };
  elements['entity-icon'] = {
    type: 'Paragraph',
    props: { text: entityIcon, fontSize: 28 },
    children: [],
  };
  elements['entity-name'] = {
    type: 'Heading',
    props: { text: entityName, level: 'h2' },
    children: [],
  };
  elements['entity-type'] = {
    type: 'Label',
    props: { text: storyData.entityDef.display_name, size: 'sm', color: '#B8AFA6' },
    children: [],
  };
  elements['context'] = {
    type: 'Paragraph',
    props: { text: storyData.context, fontSize: 14, color: '#B8AFA6' },
    children: [],
  };
  rootChildren.push('header');

  // Stats card
  if (storyData.statsCard.length > 0) {
    elements['stats-card'] = {
      type: 'StatsCard',
      props: {
        items: storyData.statsCard.map((s) => ({
          label: s.label,
          value: s.value,
        })),
      },
      children: [],
    };
    rootChildren.push('stats-card');
  }

  // Warnings
  if (storyData.warnings.length > 0) {
    const warningIds: string[] = [];
    for (let i = 0; i < storyData.warnings.length; i++) {
      const wId = `warning-${i}`;
      elements[wId] = {
        type: 'WarningBadge',
        props: {
          text: storyData.warnings[i].message,
          severity: storyData.warnings[i].severity,
        },
        children: [],
      };
      warningIds.push(wId);
    }
    elements['warnings'] = {
      type: 'Column',
      props: { gap: 6, padding: 20 },
      children: warningIds,
    };
    rootChildren.push('warnings');
  }

  // Coming up
  if (storyData.comingUp.length > 0) {
    const cuIds: string[] = ['coming-up-header'];
    elements['coming-up-header'] = {
      type: 'SectionHeader',
      props: { title: 'Coming Up', count: storyData.comingUp.length },
      children: [],
    };
    for (let i = 0; i < storyData.comingUp.length; i++) {
      const cuId = `coming-up-${i}`;
      elements[cuId] = {
        type: 'ComingUpCard',
        props: {
          display: storyData.comingUp[i].display,
          sortDate: storyData.comingUp[i].sortDate,
        },
        children: [],
      };
      cuIds.push(cuId);
    }
    elements['coming-up-section'] = {
      type: 'Column',
      props: { gap: 0 },
      children: cuIds,
    };
    rootChildren.push('coming-up-section');
  }

  // Timeline events
  if (storyData.events.length > 0) {
    elements['story-header'] = {
      type: 'SectionHeader',
      props: { title: 'Story', count: storyData.totalLoaded },
      children: [],
    };
    rootChildren.push('story-header');

    for (let i = 0; i < storyData.events.length; i++) {
      const event = storyData.events[i];
      const evId = `event-${i}`;
      elements[evId] = {
        type: 'TimelineEvent',
        props: {
          display: event.display,
          iconColor: event.iconColor,
          sortDate: event.sortDate,
          isLast: i === storyData.events.length - 1,
        },
        children: [],
      };
      rootChildren.push(evId);
    }
  }

  // Origin footer
  elements['origin'] = {
    type: 'Paragraph',
    props: { text: storyData.origin, fontSize: 14, color: '#B8AFA6', align: 'center' },
    children: [],
  };
  rootChildren.push('origin');

  // Root
  elements['root'] = {
    type: 'ScrollContainer',
    props: { padding: 0 },
    children: rootChildren,
  };

  return { root: 'root', elements };
}
