'use client';

import { colors } from '@/lib/tokens';

interface PreviewFrameProps {
  specId: string | null;
  spec?: Record<string, unknown> | null;
  isLoading?: boolean;
}

export function PreviewFrame({ specId, spec, isLoading }: PreviewFrameProps) {
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

  if (!specId || !spec) {
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

  // Extract entities from spec for preview
  const entities = (spec as { entities?: Array<{ name: string; fields?: Array<{ name: string; type: string }> }> }).entities || [];
  const meta = (spec as { meta?: { name?: string } }).meta;

  return (
    <div style={styles.container}>
      {/* Mock app header */}
      <div style={styles.appHeader}>
        <span style={styles.appTitle}>{meta?.name || 'Your App'}</span>
      </div>

      {/* Mock navigation tabs */}
      <div style={styles.navTabs}>
        {entities.slice(0, 4).map((entity, idx) => (
          <div
            key={entity.name}
            style={{
              ...styles.navTab,
              ...(idx === 0 ? styles.navTabActive : {}),
            }}
          >
            {entity.name}
          </div>
        ))}
      </div>

      {/* Mock list view */}
      <div style={styles.listContainer}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={styles.listItem}>
            <div style={styles.listItemAvatar} />
            <div style={styles.listItemContent}>
              <div style={styles.listItemTitle} />
              <div style={styles.listItemSubtitle} />
            </div>
            <div style={styles.listItemChevron}>›</div>
          </div>
        ))}
      </div>

      {/* Mock FAB */}
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
  },
  appHeader: {
    height: '44px',
    backgroundColor: colors.stream,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  appTitle: {
    color: colors.dawn,
    fontSize: '16px',
    fontWeight: 600,
  },
  navTabs: {
    display: 'flex',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    flexShrink: 0,
    overflowX: 'auto',
  },
  navTab: {
    padding: '10px 12px',
    fontSize: '12px',
    color: colors.mist,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  navTabActive: {
    color: colors.stream,
    borderBottom: `2px solid ${colors.stream}`,
    fontWeight: 500,
  },
  listContainer: {
    flex: 1,
    padding: '8px',
    overflowY: 'auto',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    marginBottom: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  listItemAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    backgroundColor: '#e8e8e8',
    marginRight: '12px',
    flexShrink: 0,
  },
  listItemContent: {
    flex: 1,
    minWidth: 0,
  },
  listItemTitle: {
    height: '14px',
    width: '70%',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    marginBottom: '6px',
  },
  listItemSubtitle: {
    height: '10px',
    width: '50%',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
  },
  listItemChevron: {
    color: '#ccc',
    fontSize: '20px',
    marginLeft: '8px',
  },
  fab: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '48px',
    height: '48px',
    borderRadius: '24px',
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
