'use client';

import { colors } from '@/lib/tokens';

interface PreviewFrameProps {
  specId: string | null;
  spec?: Record<string, unknown> | null;
  isLoading?: boolean;
}

// Expo web URL - can be configured via env var
const EXPO_WEB_URL = process.env.NEXT_PUBLIC_EXPO_WEB_URL || 'http://localhost:8081';

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

  // Load Expo web app in iframe with spec_id (matches PreviewContext)
  const iframeSrc = `${EXPO_WEB_URL}?spec_id=${encodeURIComponent(specId)}`;

  return (
    <div style={styles.container}>
      <iframe
        src={iframeSrc}
        style={styles.iframe}
        title="App Preview"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
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
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
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
