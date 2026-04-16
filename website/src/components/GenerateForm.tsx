'use client';

import { useState, FormEvent } from 'react';
import { colors } from '@/lib/tokens';

interface GenerateFormProps {
  onSubmit: (businessName: string, businessDescription: string) => void;
  isLoading: boolean;
}

export function GenerateForm({ onSubmit, isLoading }: GenerateFormProps) {
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (businessName.trim() && !isLoading) {
      onSubmit(businessName.trim(), businessDescription.trim());
    }
  };

  const isValid = businessName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.field}>
        <label htmlFor="businessName" style={styles.label}>
          Business name
        </label>
        <input
          id="businessName"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g., Sarah's Music Studio"
          style={styles.input}
          disabled={isLoading}
          required
          autoFocus
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="businessDescription" style={styles.label}>
          What does your business do?
        </label>
        <textarea
          id="businessDescription"
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          placeholder="e.g., I teach piano and vocal lessons to students of all ages. I track their progress, schedule sessions, and handle payments."
          style={{ ...styles.input, ...styles.textarea }}
          disabled={isLoading}
          rows={4}
        />
      </div>

      <button
        type="submit"
        style={{
          ...styles.button,
          opacity: isValid && !isLoading ? 1 : 0.6,
          cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
        }}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <span style={styles.buttonContent}>
            <Spinner />
            Generating...
          </span>
        ) : (
          'Generate My App'
        )}
      </button>

      <p style={styles.note}>Takes ~15-30 seconds</p>
    </form>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path
        d="M8 2a6 6 0 016 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    width: '100%',
    maxWidth: '400px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: colors.clay,
  },
  input: {
    padding: '12px 0',
    fontSize: '16px',
    color: colors.clay,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${colors.mist}`,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '100px',
    borderBottom: `2px solid ${colors.mist}`,
  },
  button: {
    height: '44px',
    padding: '0 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: colors.dawn,
    backgroundColor: colors.stream,
    border: 'none',
    borderRadius: '8px',
    marginTop: '8px',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  note: {
    fontSize: '13px',
    color: colors.mist,
    textAlign: 'center',
  },
};
