'use client';

import { useMemo } from 'react';
import { colors } from '@/lib/tokens';

interface PreviewFrameProps {
  specId: string | null;
  spec?: Record<string, unknown> | null;
  isLoading?: boolean;
}

// Types matching the spec structure
interface Field {
  name: string;
  display_name: string;
  type: string;
  options?: string[];
}

interface Entity {
  name: string;
  display_name: string;
  fields: Field[];
  relationships: Array<{
    target: string;
    type: string;
    foreign_key: string;
  }>;
}

interface Anchor {
  type: string;
  entity: string;
  greeting_template: string;
  date_label: string;
  card_display: {
    title: string;
    subtitle: string;
    time_field?: string;
    warning_field?: string;
    warning_template?: string;
  };
  summary: {
    stats: Array<{ label: string; query: string }>;
  };
  empty_state: {
    message: string;
    action?: string;
  };
}

interface Spec {
  meta?: { name?: string };
  entities?: Entity[];
  anchor?: Anchor;
}

/**
 * Generate seed data for an entity based on its fields
 */
function generateSeedData(entity: Entity, relatedEntities: Entity[], count: number = 3) {
  const items: Record<string, unknown>[] = [];

  for (let i = 1; i <= count; i++) {
    const item: Record<string, unknown> = { id: i };

    for (const field of entity.fields || []) {
      switch (field.type) {
        case 'text':
          if (field.name.toLowerCase().includes('name')) {
            item[field.name] = `${entity.display_name || entity.name} ${i}`;
          } else {
            item[field.name] = `Sample ${field.display_name || field.name}`;
          }
          break;
        case 'number':
        case 'currency':
          item[field.name] = 25 * i;
          break;
        case 'phone':
          item[field.name] = `555-010${i}`;
          break;
        case 'email':
          item[field.name] = `sample${i}@example.com`;
          break;
        case 'datetime':
        case 'time': {
          const hour = 9 + i;
          item[field.name] = `${hour.toString().padStart(2, '0')}:00`;
          break;
        }
        case 'date': {
          const date = new Date();
          item[field.name] = date.toISOString().split('T')[0];
          break;
        }
        case 'choice':
          item[field.name] = field.options?.[i % (field.options?.length || 1)] || 'Option';
          break;
        case 'toggle':
          item[field.name] = i % 2 === 0;
          break;
        case 'duration':
          item[field.name] = 30 + (i * 15);
          break;
        default:
          item[field.name] = '';
      }
    }

    // Add foreign keys for relationships
    for (const rel of entity.relationships || []) {
      if (rel.type === 'belongs_to') {
        item[rel.foreign_key] = i;
      }
    }

    items.push(item);
  }

  return items;
}

/**
 * Generate related entity data for template resolution
 */
function generateRelatedData(entities: Entity[], anchorEntity: Entity) {
  const relatedData: Record<string, Record<string, unknown>[]> = {};

  for (const rel of anchorEntity.relationships || []) {
    if (rel.type === 'belongs_to') {
      const relatedEntity = entities.find(e => e.name === rel.target);
      if (relatedEntity) {
        relatedData[rel.target.toLowerCase()] = generateSeedData(relatedEntity, entities);
      }
    }
  }

  return relatedData;
}

/**
 * Resolve template strings like "{{entity.field}}" with actual data
 */
function resolveTemplate(
  template: string,
  entity: Record<string, unknown>,
  related: Record<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');

    if (parts.length === 1) {
      return String(entity[parts[0]] ?? '');
    }

    if (parts.length === 2) {
      const [entityName, fieldName] = parts;
      const relatedEntity = related[entityName.toLowerCase()];
      if (relatedEntity) {
        return String(relatedEntity[fieldName] ?? '');
      }
      return String(entity[fieldName] ?? '');
    }

    return '';
  });
}

/**
 * Get time of day for greeting
 */
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Format time for display
 */
function formatTime(time: string): string {
  if (!time) return '';

  // Handle HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  return time;
}

export function PreviewFrame({ specId, spec, isLoading }: PreviewFrameProps) {
  // Parse spec data
  const previewData = useMemo(() => {
    if (!spec) return null;

    const typedSpec = spec as Spec;
    const anchor = typedSpec.anchor;
    const entities = typedSpec.entities || [];
    const meta = typedSpec.meta;

    // Handle case where anchor is missing - show entity-based preview
    const anchorEntity = anchor?.entity
      ? entities.find(e => e.name === anchor.entity)
      : entities[0];

    if (!anchorEntity) {
      // Fallback to simple entity list preview
      return {
        appName: meta?.name || 'Your App',
        greeting: `Good ${getTimeOfDay()}!`,
        dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        stats: [{ label: 'Entities', value: entities.length }],
        cards: entities.slice(0, 3).map((e, i) => ({
          id: i,
          title: e.display_name || e.name,
          subtitle: `${e.fields?.length || 0} fields`,
          time: '',
        })),
        emptyMessage: 'No data yet',
      };
    }

    // Generate seed data
    const seedData = generateSeedData(anchorEntity, entities);
    const relatedData = generateRelatedData(entities, anchorEntity);

    // Resolve greeting with safe fallback
    const greetingTemplate = anchor?.greeting_template || 'Good {{time_of_day}}!';
    const greeting = greetingTemplate
      .replace('{{time_of_day}}', getTimeOfDay())
      .replace('{{user_name}}', meta?.name || 'there');

    // Generate cards from seed data
    const cardDisplay = anchor?.card_display || {
      title: '{{name}}',
      subtitle: '',
      time_field: 'datetime',
    };

    const cards = seedData.map((item, idx) => {
      // Get related entity for this item
      const belongsTo = anchorEntity.relationships?.find(r => r.type === 'belongs_to');
      const relatedMap: Record<string, Record<string, unknown>> = {};

      if (belongsTo) {
        const fkValue = item[belongsTo.foreign_key] as number;
        const relatedItems = relatedData[belongsTo.target.toLowerCase()];
        if (relatedItems) {
          const relatedItem = relatedItems.find(r => r.id === fkValue);
          if (relatedItem) {
            relatedMap[belongsTo.target.toLowerCase()] = relatedItem;
          }
        }
      }

      const title = resolveTemplate(cardDisplay.title || '{{name}}', item, relatedMap);
      const subtitle = resolveTemplate(cardDisplay.subtitle || '', item, relatedMap);
      const timeField = cardDisplay.time_field || 'datetime';
      const time = formatTime(String(item[timeField] || ''));

      return { id: idx, title, subtitle, time };
    });

    // Generate stats with safe fallback
    const anchorStats = anchor?.summary?.stats || [];
    const stats = anchorStats.length > 0
      ? anchorStats.map(stat => ({
          label: stat.label,
          value: stat.query?.includes('count') ? seedData.length :
                 stat.query?.includes('total') ? `Rs.${seedData.length * 25}` : 0,
        }))
      : [
          { label: 'Today', value: seedData.length },
          { label: 'This Week', value: seedData.length * 3 },
        ];

    // Date label with fallback
    const dateLabel = anchor?.date_label ||
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return {
      appName: meta?.name || 'Your App',
      greeting,
      dateLabel,
      stats,
      cards,
      emptyMessage: anchor?.empty_state?.message || 'No items yet. Tap + to add your first one!',
    };
  }, [spec]);

  if (isLoading) {
    return (
      <div style={styles.skeleton}>
        <div style={styles.skeletonContent}>
          <Spinner />
          <span style={styles.skeletonText}>Generating preview...</span>
        </div>
      </div>
    );
  }

  if (!specId || !spec || !previewData) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📱</div>
        <p style={styles.emptyText}>Preview will appear here</p>
        <p style={styles.emptySubtext}>
          Fill out the form to generate your app
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Greeting Section */}
      <div style={styles.greetingSection}>
        <h2 style={styles.greeting}>{previewData.greeting}</h2>
        <p style={styles.dateLabel}>{previewData.dateLabel}</p>
      </div>

      {/* Stats Card */}
      {previewData.stats.length > 0 && (
        <div style={styles.statsCard}>
          {previewData.stats.map((stat, idx) => (
            <div
              key={stat.label}
              style={{
                ...styles.statItem,
                ...(idx > 0 ? styles.statItemBorder : {}),
              }}
            >
              <span style={styles.statValue}>{stat.value}</span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Story Cards */}
      <div style={styles.cardsContainer}>
        {previewData.cards.map((card) => (
          <div key={card.id} style={styles.card}>
            <div style={styles.cardContent}>
              <div style={styles.cardMain}>
                <span style={styles.cardTitle}>{card.title}</span>
                <span style={styles.cardSubtitle}>{card.subtitle}</span>
              </div>
              <span style={styles.cardTime}>{card.time}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Button */}
      <div style={styles.fab}>+</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" stroke={colors.mist} strokeWidth="2" opacity="0.3" />
      <path
        d="M12 3a9 9 0 019 9"
        stroke={colors.stream}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: colors.dawn,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '16px',
  },
  greetingSection: {
    marginBottom: '12px',
  },
  greeting: {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.clay,
    margin: 0,
    lineHeight: 1.3,
  },
  dateLabel: {
    fontSize: '12px',
    color: colors.mist,
    marginTop: '4px',
    textTransform: 'capitalize',
  },
  statsCard: {
    display: 'flex',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeft: '1px solid rgba(0,0,0,0.08)',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 600,
    color: colors.clay,
  },
  statLabel: {
    fontSize: '10px',
    color: colors.mist,
    marginTop: '2px',
  },
  cardsContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    marginRight: '8px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.clay,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardSubtitle: {
    fontSize: '12px',
    color: colors.mist,
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardTime: {
    fontSize: '12px',
    fontWeight: 500,
    color: colors.stream,
    flexShrink: 0,
  },
  fab: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '44px',
    height: '44px',
    borderRadius: '22px',
    backgroundColor: colors.stream,
    color: colors.dawn,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  skeleton: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dawn,
  },
  skeletonContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  skeletonText: {
    fontSize: '14px',
    color: colors.mist,
  },
  empty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: colors.dawn,
    padding: '24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: 500,
    color: colors.clay,
  },
  emptySubtext: {
    fontSize: '14px',
    color: colors.mist,
  },
};
