'use client';

import { colors, shadows, radii } from '@/lib/tokens';

interface DeviceMockupProps {
  children: React.ReactNode;
  title?: string;
}

export function DeviceMockup({ children, title }: DeviceMockupProps) {
  return (
    <div style={styles.container}>
      {title && <h3 style={styles.title}>{title}</h3>}
      <div style={styles.device}>
        {/* Status bar */}
        <div style={styles.statusBar}>
          <span style={styles.time}>9:41</span>
          <div style={styles.notch} />
          <div style={styles.icons}>
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div>
        {/* Content */}
        <div style={styles.content}>{children}</div>
        {/* Home indicator */}
        <div style={styles.homeIndicator} />
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect x="0" y="8" width="3" height="4" rx="1" fill={colors.clay} />
      <rect x="4" y="5" width="3" height="7" rx="1" fill={colors.clay} />
      <rect x="8" y="2" width="3" height="10" rx="1" fill={colors.clay} />
      <rect x="12" y="0" width="3" height="12" rx="1" fill={colors.clay} opacity="0.3" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path
        d="M8 10a1 1 0 100-2 1 1 0 000 2z"
        fill={colors.clay}
      />
      <path
        d="M4.93 6.93a4.5 4.5 0 016.14 0"
        stroke={colors.clay}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2.1 4.1a8 8 0 0111.8 0"
        stroke={colors.clay}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
      <rect x="0.5" y="0.5" width="20" height="11" rx="2.5" stroke={colors.clay} />
      <rect x="2" y="2" width="14" height="8" rx="1" fill={colors.bloom} />
      <path d="M22 4v4a2 2 0 000-4z" fill={colors.clay} opacity="0.4" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 500,
    color: colors.clay,
    textAlign: 'center',
  },
  device: {
    width: '280px',
    height: '580px',
    backgroundColor: colors.dawn,
    borderRadius: '32px',
    border: `1px solid ${colors.clay}`,
    boxShadow: shadows.elevated,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  statusBar: {
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    backgroundColor: colors.dawn,
    position: 'relative',
  },
  time: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.clay,
  },
  notch: {
    position: 'absolute',
    top: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100px',
    height: '28px',
    backgroundColor: colors.clay,
    borderRadius: '0 0 16px 16px',
  },
  icons: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.dawn,
  },
  homeIndicator: {
    width: '120px',
    height: '4px',
    backgroundColor: colors.clay,
    borderRadius: '2px',
    margin: '8px auto 12px',
  },
};
