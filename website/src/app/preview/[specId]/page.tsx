'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { colors } from '@/lib/tokens';

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
function generateSeedData(entity: Entity, count: number = 5) {
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
        relatedData[rel.target.toLowerCase()] = generateSeedData(relatedEntity);
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

export default function PreviewPage() {
  const params = useParams();
  const specId = params.specId as string;

  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSpec() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7130';
        const response = await fetch(`${apiUrl}/functions/get-spec?id=${specId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('App not found. Please generate a new app.');
          } else {
            setError('Failed to load app. Please try again.');
          }
          return;
        }

        const result = await response.json();

        if (!result.success || !result.data?.spec) {
          setError(result.error || 'App not found. Please generate a new app.');
          return;
        }

        setSpec(result.data.spec);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load app');
      } finally {
        setLoading(false);
      }
    }

    if (specId) {
      loadSpec();
    }
  }, [specId]);

  // Parse spec data for story cards
  const previewData = useMemo(() => {
    if (!spec) return null;

    const anchor = spec.anchor;
    const entities = spec.entities || [];
    const meta = spec.meta;

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
        cards: entities.slice(0, 5).map((e, i) => ({
          id: i,
          title: e.display_name || e.name,
          subtitle: `${e.fields?.length || 0} fields`,
          time: '',
        })),
        emptyMessage: 'No data yet',
      };
    }

    // Generate seed data
    const seedData = generateSeedData(anchorEntity);
    const relatedData = generateRelatedData(entities, anchorEntity);

    // Resolve greeting with safe fallback
    const greetingTemplate = anchor?.greeting_template || 'Good {{time_of_day}}!';
    const greeting = greetingTemplate
      .replace('{{time_of_day}}', getTimeOfDay())
      .replace('{{user_name}}', meta?.name || 'there');

    // Find first text field for default title template
    const firstTextField = anchorEntity.fields?.find(f => f.type === 'text')?.name;
    const firstTimeField = anchorEntity.fields?.find(f => f.type === 'time' || f.type === 'datetime')?.name;

    // Generate cards from seed data
    const cardDisplay = anchor?.card_display || {
      title: firstTextField ? `{{${firstTextField}}}` : '',
      subtitle: '',
      time_field: firstTimeField || 'time',
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

      let title = resolveTemplate(cardDisplay.title || '', item, relatedMap);
      // Fallback to entity name + id if title is empty
      if (!title.trim()) {
        title = `${anchorEntity.display_name || anchorEntity.name} ${idx + 1}`;
      }
      const subtitle = resolveTemplate(cardDisplay.subtitle || '', item, relatedMap);
      const timeField = cardDisplay.time_field || 'time';
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

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your app...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !spec || !previewData) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Unable to load app</h2>
        <p style={styles.errorText}>{error || 'Spec not found'}</p>
        <a href="/" style={styles.backLink}>Create a new app</a>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span style={styles.statusTime}>9:41</span>
        <div style={styles.statusIcons}>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Greeting Section */}
      <div style={styles.greetingSection}>
        <h1 style={styles.greeting}>{previewData.greeting}</h1>
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
                {card.subtitle && (
                  <span style={styles.cardSubtitle}>{card.subtitle}</span>
                )}
              </div>
              {card.time && (
                <span style={styles.cardTime}>{card.time}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Button */}
      <div style={styles.fab}>+</div>

      {/* Footer */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>
          Powered by <a href="/" style={styles.footerLink}>KAS</a>
        </span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.dawn,
    position: 'relative',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: colors.dawn,
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.mist}`,
    borderTopColor: colors.stream,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: colors.mist,
    fontSize: '16px',
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    textAlign: 'center',
    backgroundColor: colors.dawn,
  },
  errorTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: colors.clay,
  },
  errorText: {
    color: colors.mist,
    fontSize: '16px',
  },
  backLink: {
    marginTop: '16px',
    color: colors.stream,
    textDecoration: 'underline',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 20px',
    backgroundColor: colors.dawn,
  },
  statusTime: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.clay,
  },
  statusIcons: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
  },
  greetingSection: {
    padding: '16px 20px',
    paddingTop: '8px',
  },
  greeting: {
    fontSize: '28px',
    fontWeight: 600,
    color: colors.clay,
    margin: 0,
    lineHeight: 1.3,
  },
  dateLabel: {
    fontSize: '14px',
    color: colors.mist,
    marginTop: '6px',
    textTransform: 'capitalize',
  },
  statsCard: {
    display: 'flex',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '20px',
    margin: '0 20px 16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
    fontSize: '32px',
    fontWeight: 600,
    color: colors.clay,
  },
  statLabel: {
    fontSize: '13px',
    color: colors.mist,
    marginTop: '4px',
  },
  cardsContainer: {
    flex: 1,
    padding: '0 20px',
    paddingBottom: '100px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
    marginRight: '12px',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: colors.clay,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: colors.mist,
    marginTop: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardTime: {
    fontSize: '14px',
    fontWeight: 500,
    color: colors.stream,
    flexShrink: 0,
  },
  fab: {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '28px',
    backgroundColor: colors.stream,
    color: colors.dawn,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    cursor: 'pointer',
  },
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px',
    textAlign: 'center',
    borderTop: '1px solid rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
  },
  footerText: {
    fontSize: '13px',
    color: colors.mist,
  },
  footerLink: {
    color: colors.stream,
    textDecoration: 'none',
  },
};
