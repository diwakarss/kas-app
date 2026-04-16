'use client';

import { useState, useCallback } from 'react';
import { colors } from '@/lib/tokens';
import { generateSpec, GenerateProgressEvent, GenerateCompleteEvent } from '@/lib/api';
import { GenerateForm } from '@/components/GenerateForm';
import { ProgressStepper } from '@/components/ProgressStepper';
import { DeviceMockup } from '@/components/DeviceMockup';
import { PreviewFrame } from '@/components/PreviewFrame';

type AppState = 'idle' | 'generating' | 'complete' | 'error';

export default function Home() {
  const [state, setState] = useState<AppState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [specId, setSpecId] = useState<string | null>(null);
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(
    async (name: string, description: string) => {
      setState('generating');
      setCurrentStep(1);
      setBusinessName(name);
      setError(null);

      await generateSpec({
        businessName: name,
        businessDescription: description,
        onProgress: (event: GenerateProgressEvent) => {
          setCurrentStep(event.step);
        },
        onComplete: (event: GenerateCompleteEvent) => {
          setCurrentStep(5);
          setSpecId(event.specId);
          setSpec(event.spec);
          // Spec is now stored in the database by the backend
          setState('complete');
        },
        onError: (errorMsg: string) => {
          setError(errorMsg);
          setState('error');
        },
      });
    },
    []
  );

  const handleReset = () => {
    setState('idle');
    setCurrentStep(0);
    setSpecId(null);
    setSpec(null);
    setBusinessName('');
    setError(null);
  };

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        {/* Left Column: Hero + Form/Progress */}
        <div style={styles.leftColumn}>
          {/* Hero */}
          <header style={styles.hero}>
            <h1 style={styles.headline}>Your business, your app. In minutes.</h1>
            <p style={styles.subhead}>
              Describe your business and get a working app — no coding required.
            </p>
          </header>

          {/* Form or Progress */}
          <div style={styles.formSection}>
            {state === 'idle' ? (
              <GenerateForm onSubmit={handleGenerate} isLoading={false} />
            ) : state === 'generating' || state === 'error' ? (
              <div style={styles.progressContainer}>
                <ProgressStepper currentStep={currentStep} error={error} />
                {state === 'error' && (
                  <button style={styles.retryButton} onClick={handleReset}>
                    Try Again
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.successSection}>
                <div style={styles.successMessage}>
                  <span style={styles.successIcon}>✓</span>
                  <span>Your app is ready!</span>
                </div>
                <div style={styles.ctaButtons}>
                  <a
                    href={`kas-app://spec/${specId}`}
                    style={styles.primaryButton}
                  >
                    Download the App
                  </a>
                  <button style={styles.secondaryButton} onClick={handleReset}>
                    Create Another
                  </button>
                </div>
                <p style={styles.ctaNote}>
                  Or{' '}
                  <a
                    href={`/preview/${specId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    continue on web
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Device Preview */}
        <div style={styles.rightColumn}>
          <DeviceMockup
            title={
              state === 'complete' && businessName
                ? `Your ${businessName} app`
                : undefined
            }
          >
            <PreviewFrame
              specId={specId}
              spec={spec}
              isLoading={state === 'generating'}
            />
          </DeviceMockup>
        </div>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <a href="/privacy" style={styles.footerLink}>
          Privacy Policy
        </a>
        <span style={styles.footerDivider}>|</span>
        <a href="/terms" style={styles.footerLink}>
          Terms
        </a>
        <span style={styles.footerDivider}>|</span>
        <a href="mailto:hello@kas-app.com" style={styles.footerLink}>
          Contact
        </a>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.dawn,
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '48px 24px',
    gap: '64px',
  },
  leftColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    maxWidth: '480px',
  },
  hero: {
    marginBottom: '32px',
  },
  headline: {
    fontSize: '32px',
    fontWeight: 600,
    color: colors.clay,
    lineHeight: 1.2,
    marginBottom: '12px',
  },
  subhead: {
    fontSize: '16px',
    color: colors.mist,
    lineHeight: 1.5,
  },
  formSection: {
    width: '100%',
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  retryButton: {
    alignSelf: 'flex-start',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.dawn,
    backgroundColor: colors.ember,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  successSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '18px',
    fontWeight: 500,
    color: colors.bloom,
  },
  successIcon: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bloom,
    color: colors.dawn,
    borderRadius: '50%',
    fontSize: '14px',
    fontWeight: 600,
  },
  ctaButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '44px',
    padding: '0 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: colors.dawn,
    backgroundColor: colors.stream,
    borderRadius: '8px',
    textDecoration: 'none',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '44px',
    padding: '0 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: colors.stream,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.stream}`,
    borderRadius: '8px',
    cursor: 'pointer',
  },
  ctaNote: {
    fontSize: '14px',
    color: colors.mist,
  },
  link: {
    color: colors.stream,
    textDecoration: 'underline',
  },
  rightColumn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '24px',
    borderTop: `1px solid ${colors.mist}20`,
  },
  footerLink: {
    fontSize: '13px',
    color: colors.mist,
    textDecoration: 'none',
  },
  footerDivider: {
    color: colors.mist,
    opacity: 0.5,
  },
};

// Add media query styles via CSS
const mediaStyles = `
  @media (max-width: 768px) {
    .container {
      flex-direction: column !important;
      padding: 24px 16px !important;
      gap: 32px !important;
    }
    .leftColumn {
      max-width: 100% !important;
    }
    .headline {
      font-size: 24px !important;
    }
  }
`;
