'use client';

import { useState } from 'react';
import { colors } from '@/lib/tokens';

interface PreviewFrameProps {
  specId: string | null;
  isLoading?: boolean;
}

export function PreviewFrame({ specId, isLoading }: PreviewFrameProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const previewUrl = specId
    ? `${process.env.NEXT_PUBLIC_PREVIEW_URL}?spec_id=${specId}`
    : null;

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

  if (!specId) {
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

  if (iframeError) {
    return (
      <div style={styles.error}>
        <div style={styles.errorIcon}>⚠️</div>
        <p style={styles.errorText}>Preview unavailable</p>
        <button
          style={styles.retryButton}
          onClick={() => {
            setIframeError(false);
            setIframeLoaded(false);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {!iframeLoaded && (
        <div style={styles.loading}>
          <Spinner />
          <span style={styles.loadingText}>Loading preview...</span>
        </div>
      )}
      <iframe
        src={previewUrl!}
        style={{
          ...styles.iframe,
          opacity: iframeLoaded ? 1 : 0,
        }}
        onLoad={() => setIframeLoaded(true)}
        onError={() => setIframeError(true)}
        title="App Preview"
        sandbox="allow-scripts allow-same-origin"
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
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    transition: 'opacity 0.3s',
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    backgroundColor: colors.dawn,
  },
  loadingText: {
    fontSize: '14px',
    color: colors.mist,
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
  error: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    backgroundColor: colors.dawn,
    padding: '24px',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '32px',
  },
  errorText: {
    fontSize: '14px',
    color: colors.ember,
  },
  retryButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.stream,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.stream}`,
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
