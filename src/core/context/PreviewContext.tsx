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
  /**
   * Bundled fixture slug ("yoga-studio", "vet-clinic", ...) when the URL has
   * `?fixture=<slug>`. Lets a UI developer preview without the InsForge
   * backend running.
   */
  fixtureSlug: string | null;
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
  fixtureSlug: null,
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
 * Extract preview source from URL query params (web only).
 * Either `?spec_id=<uuid>` (fetched from InsForge) or `?fixture=<slug>`
 * (loaded from a JSON bundled into the app for offline UI work).
 */
function getPreviewSourceFromUrl(): { specId: string | null; fixtureSlug: string | null } {
  if (Platform.OS !== 'web') return { specId: null, fixtureSlug: null };
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      specId: params.get('spec_id'),
      fixtureSlug: params.get('fixture'),
    };
  } catch {
    return { specId: null, fixtureSlug: null };
  }
}

interface PreviewProviderProps {
  children: ReactNode;
}

export function PreviewProvider({ children }: PreviewProviderProps) {
  const [state, setState] = useState<PreviewState>(() => {
    const { specId, fixtureSlug } = getPreviewSourceFromUrl();
    const inPreview = specId !== null || fixtureSlug !== null;
    return {
      isPreviewMode: inPreview,
      specId,
      fixtureSlug,
      isLoading: inPreview,
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
