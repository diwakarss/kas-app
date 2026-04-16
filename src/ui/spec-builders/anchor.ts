/**
 * Anchor Screen Spec Builder
 *
 * Converts anchor hook data into a json-render {root, elements} spec.
 * Element order is guaranteed: Greeting → SummaryStats → EntityCards → EmptyState → FloatingActions
 */

import type { Spec } from '@json-render/core';
import type { AnchorData, AnchorCard } from '../../hooks/useAnchorData';
import type { KASAppSpecV2 } from '../../core/types/kas-spec-v2';
import { catalog } from '../catalog';

export function buildAnchorSpec(anchorData: AnchorData, appSpec: KASAppSpecV2): Spec {
  const elements: Record<string, any> = {};
  const rootChildren: string[] = [];

  // Greeting
  elements['greeting'] = {
    type: 'Greeting',
    props: {
      greeting: anchorData.greeting,
      dateLabel: anchorData.dateLabel,
    },
    children: [],
  };
  rootChildren.push('greeting');

  // Summary stats
  if (anchorData.stats.length > 0) {
    elements['summary-stats'] = {
      type: 'SummaryStats',
      props: { stats: anchorData.stats },
      children: [],
    };
    rootChildren.push('summary-stats');
  }

  // Entity cards
  if (anchorData.cards.length > 0) {
    const cardIds: string[] = [];
    for (let i = 0; i < anchorData.cards.length; i++) {
      const card = anchorData.cards[i];
      const cardId = `card-${i}`;
      const belongsTo = findBelongsTo(appSpec);

      elements[cardId] = {
        type: 'EntityCard',
        props: {
          title: card.title,
          subtitle: card.subtitle,
          time: card.time,
          warningText: card.warningText,
          entityType: belongsTo?.target ?? appSpec.ui_hints.anchor.entity,
          entityId: belongsTo ? card.rawData[belongsTo.foreign_key] ?? card.id : card.id,
        },
        children: [],
        on: belongsTo?.target
          ? {
              press: {
                action: 'navigate',
                params: {
                  screen: 'Story',
                  entityType: belongsTo.target,
                  entityId: belongsTo ? card.rawData[belongsTo.foreign_key] ?? card.id : card.id,
                },
              },
            }
          : undefined,
      };
      cardIds.push(cardId);
    }

    elements['card-list'] = {
      type: 'Column',
      props: { gap: 0 },
      children: cardIds,
    };
    rootChildren.push('card-list');
  } else {
    // Empty state
    elements['empty-state'] = {
      type: 'EmptyState',
      props: {
        message: anchorData.emptyMessage,
        actionLabel: anchorData.emptyAction,
        actionEntityType: appSpec.ui_hints.anchor.entity,
      },
      children: [],
    };
    rootChildren.push('empty-state');
  }

  // Floating actions
  const addFlowEntities = Object.keys(appSpec.ui_hints.add_flows);
  if (addFlowEntities.length > 0) {
    elements['floating-actions'] = {
      type: 'FloatingActions',
      props: {
        actions: addFlowEntities.map((entityName) => {
          const entityDef = appSpec.entities.find((e) => e.name === entityName);
          return {
            label: entityDef?.display_name ?? entityName,
            entityType: entityName,
            icon: entityDef?.icon ?? '+',
          };
        }),
      },
      children: [],
    };
    rootChildren.push('floating-actions');
  }

  // Root
  elements['root'] = {
    type: 'SafeArea',
    props: { backgroundColor: '#FAF7F2' },
    children: rootChildren,
  };

  const builtSpec: Spec = { root: 'root', elements };

  const validation = catalog.validate(builtSpec);
  if (!validation.success) {
    console.warn('[anchor builder] produced invalid spec:', validation.error);
  }

  return builtSpec;
}

function findBelongsTo(appSpec: KASAppSpecV2) {
  const anchorEntity = appSpec.entities.find(
    (e) => e.name === appSpec.ui_hints.anchor.entity,
  );
  return anchorEntity?.relationships.find((r) => r.type === 'belongs_to') ?? null;
}
