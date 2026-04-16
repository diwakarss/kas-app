'use client';

import { useParams } from 'next/navigation';
import { colors } from '@/lib/tokens';

// Expo web URL - can be configured via env var
const EXPO_WEB_URL = process.env.NEXT_PUBLIC_EXPO_WEB_URL || 'http://localhost:8081';

export default function PreviewPage() {
  const params = useParams();
  const specId = params.specId as string;

  if (!specId) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Invalid Preview</h2>
        <p style={styles.errorText}>No app ID provided</p>
        <a href="/" style={styles.backLink}>Create a new app</a>
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

      {/* Footer with link back to generator */}
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
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.dawn,
  },
  iframe: {
    flex: 1,
    width: '100%',
    border: 'none',
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
  footer: {
    padding: '12px',
    textAlign: 'center',
    borderTop: '1px solid rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    flexShrink: 0,
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
