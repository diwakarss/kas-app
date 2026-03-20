'use client';

import { useState, useEffect, useRef } from 'react';
import { colors } from '@/lib/tokens';

export interface ProgressStep {
  step: number;
  message: string;
  subtitle: string;
}

export const PROGRESS_STEPS: ProgressStep[] = [
  { step: 1, message: 'Analyzing business type...', subtitle: 'Understanding your business needs' },
  { step: 2, message: 'Generating entities...', subtitle: 'Creating your data structure' },
  { step: 3, message: 'Building relationships...', subtitle: 'Connecting your business logic' },
  { step: 4, message: 'Validating spec...', subtitle: 'Making sure everything works' },
  { step: 5, message: 'Complete!', subtitle: 'Your app is ready' },
];

// Minimum time to show each step (in ms)
const STEP_MIN_DURATION = 1500;

interface ProgressStepperProps {
  currentStep: number;
  error?: string | null;
}

export function ProgressStepper({ currentStep, error }: ProgressStepperProps) {
  const [displayedStep, setDisplayedStep] = useState(1);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const targetStepRef = useRef(currentStep);

  useEffect(() => {
    targetStepRef.current = currentStep;

    // If target is ahead of displayed, animate towards it
    if (currentStep > displayedStep) {
      const animateToTarget = () => {
        setDisplayedStep((prev) => {
          const next = prev + 1;
          // If we haven't reached the target, schedule next animation
          if (next < targetStepRef.current) {
            animationRef.current = setTimeout(animateToTarget, STEP_MIN_DURATION);
          }
          return next;
        });
      };

      // Clear any existing animation
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }

      // Start animation after current step has been shown for minimum duration
      animationRef.current = setTimeout(animateToTarget, STEP_MIN_DURATION);
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [currentStep, displayedStep]);

  // Use displayedStep for rendering instead of currentStep
  const visibleStep = displayedStep;
  return (
    <div style={styles.container}>
      {PROGRESS_STEPS.map((step, index) => {
        const isComplete = visibleStep > step.step;
        const isCurrent = visibleStep === step.step;
        const isPending = visibleStep < step.step;
        const isError = error && isCurrent;

        return (
          <div key={step.step} style={styles.stepRow}>
            {/* Step indicator */}
            <div
              style={{
                ...styles.indicator,
                backgroundColor: isError
                  ? colors.ember
                  : isComplete
                  ? colors.bloom
                  : isCurrent
                  ? colors.stream
                  : 'transparent',
                borderColor: isError
                  ? colors.ember
                  : isComplete
                  ? colors.bloom
                  : isCurrent
                  ? colors.stream
                  : colors.mist,
              }}
            >
              {isComplete ? (
                <CheckIcon />
              ) : isCurrent && !isError ? (
                <Spinner />
              ) : isError ? (
                <ErrorIcon />
              ) : (
                <span style={{ color: colors.mist }}>{step.step}</span>
              )}
            </div>

            {/* Connector line */}
            {index < PROGRESS_STEPS.length - 1 && (
              <div
                style={{
                  ...styles.connector,
                  backgroundColor: isComplete ? colors.bloom : colors.mist,
                  opacity: isComplete ? 1 : 0.3,
                }}
              />
            )}

            {/* Step content */}
            <div style={styles.content}>
              <span
                style={{
                  ...styles.message,
                  color: isError ? colors.ember : isCurrent ? colors.clay : isPending ? colors.mist : colors.clay,
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {step.message}
              </span>
              <span
                style={{
                  ...styles.subtitle,
                  color: isError ? colors.ember : colors.mist,
                }}
              >
                {isError ? error : step.subtitle}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M11.5 3.5L5.5 10.5L2.5 7.5"
        stroke={colors.dawn}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M10 4L4 10M4 4L10 10"
        stroke={colors.dawn}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5" stroke={colors.dawn} strokeWidth="2" opacity="0.3" />
      <path
        d="M7 2C9.76 2 12 4.24 12 7"
        stroke={colors.dawn}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    padding: '24px 0',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    position: 'relative',
    paddingBottom: '24px',
  },
  indicator: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 500,
    zIndex: 1,
    backgroundColor: colors.dawn,
  },
  connector: {
    position: 'absolute',
    left: '13px',
    top: '28px',
    width: '2px',
    height: '24px',
  },
  content: {
    marginLeft: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  message: {
    fontSize: '14px',
    lineHeight: '20px',
  },
  subtitle: {
    fontSize: '13px',
    lineHeight: '18px',
  },
};
