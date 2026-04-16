/**
 * Deep Link Handler
 *
 * Handles kas-app:// deep links for opening specific specs.
 * URL format: kas-app://spec/{specId}
 */

import { Linking, Platform } from 'react-native';

const SCHEME = 'kas-app';

export interface DeepLinkResult {
  type: 'spec' | 'unknown';
  specId?: string;
}

/**
 * Parse a deep link URL
 */
export function parseDeepLink(url: string | null): DeepLinkResult | null {
  if (!url) return null;

  try {
    // Handle kas-app://spec/{id}
    if (url.startsWith(`${SCHEME}://spec/`)) {
      const specId = url.replace(`${SCHEME}://spec/`, '').split('?')[0];
      if (specId) {
        return { type: 'spec', specId };
      }
    }

    // Handle web URLs with spec_id param
    if (url.includes('spec_id=')) {
      const params = new URL(url).searchParams;
      const specId = params.get('spec_id');
      if (specId) {
        return { type: 'spec', specId };
      }
    }

    return { type: 'unknown' };
  } catch (error) {
    console.error('[DeepLinks] Parse error:', error);
    return null;
  }
}

/**
 * Get the initial URL that launched the app
 */
export async function getInitialDeepLink(): Promise<DeepLinkResult | null> {
  try {
    const url = await Linking.getInitialURL();
    return parseDeepLink(url);
  } catch (error) {
    console.error('[DeepLinks] Get initial URL error:', error);
    return null;
  }
}

/**
 * Subscribe to incoming deep links
 */
export function subscribeToDeepLinks(
  onLink: (result: DeepLinkResult) => void
): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const result = parseDeepLink(url);
    if (result) {
      onLink(result);
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Create a deep link URL for a spec
 */
export function createSpecDeepLink(specId: string): string {
  return `${SCHEME}://spec/${specId}`;
}

/**
 * Check if deep linking is supported
 */
export async function canOpenDeepLinks(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(`${SCHEME}://`);
  } catch {
    return false;
  }
}
