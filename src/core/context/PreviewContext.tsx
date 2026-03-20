/**
 * Preview Context
 *
 * Manages preview mode state for web embeds.
 * When in preview mode:
 * - Data is read-only (sample data from API)
 * - No persistence
 * - Limited navigation (no edit screens)
 */

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface PreviewState {
  isPreviewMode: boolean;
  specId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface PreviewContextValue extends PreviewState {
  /** Called when preview data is successfully loaded */
  setPreviewReady: () => void;
  /** Called when preview loading fails */
  setPreviewError: (error: string) => void;
}

const defaultState: PreviewContextValue = {
  isPreviewMode: false,
  specId: null,
  isLoading: false,
  error: null,
  setPreviewReady: () => {},
  setPreviewError: () => {},
};

export const PreviewContext = createContext<PreviewContextValue>(defaultState);

export function usePreview(): PreviewContextValue {
  return useContext(PreviewContext);
}

/**
 * Extract spec_id from URL query params (web only)
 */
function getSpecIdFromUrl(): string | null {
  if (Platform.OS !== 'web') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('spec_id');
  } catch {
    return null;
  }
}

interface PreviewProviderProps {
  children: ReactNode;
}

export function PreviewProvider({ children }: PreviewProviderProps) {
  const [state, setState] = useState<PreviewState>(() => {
    const specId = getSpecIdFromUrl();
    return {
      isPreviewMode: specId !== null,
      specId,
      isLoading: specId !== null,
      error: null,
    };
  });

  const setPreviewReady = () => {
    setState((prev) => ({ ...prev, isLoading: false }));
  };

  const setPreviewError = (error: string) => {
    setState((prev) => ({ ...prev, isLoading: false, error }));
  };

  const value: PreviewContextValue = {
    ...state,
    setPreviewReady,
    setPreviewError,
  };

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
}
