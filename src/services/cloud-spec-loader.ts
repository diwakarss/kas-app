/**
 * Cloud Spec Loader
 *
 * Handles fetching specs from the InsForge backend,
 * with local caching and offline support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KASAppSpec } from '../core/types/spec';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7130';

// Storage keys
const CACHED_SPEC_KEY = '@kas_cached_spec';
const CACHED_SPEC_VERSION_KEY = '@kas_cached_spec_version';
const CACHED_SPEC_TIMESTAMP_KEY = '@kas_cached_spec_timestamp';

export interface CloudSpec {
  id: string;
  name: string;
  version: number;
  spec: KASAppSpec;
  updatedAt: string;
}

export interface SpecListItem {
  id: string;
  name: string;
  businessType: string;
  version: number;
  updatedAt: string;
}

export interface CloudSpecLoaderResult {
  success: boolean;
  spec?: CloudSpec;
  fromCache?: boolean;
  error?: string;
}

/**
 * Fetch user's specs from the cloud
 * NOTE: Currently returns empty - requires user_id on app_instance records
 * TODO: Update generate-spec to set user_id when user is authenticated
 */
export async function fetchUserSpecs(token: string): Promise<{
  success: boolean;
  specs?: SpecListItem[];
  error?: string;
}> {
  try {
    // Query app_instance table for user's specs
    // This requires the app_instance to have user_id set during generation
    const response = await fetch(`${API_BASE_URL}/api/database/records/app_instance`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Session expired' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const records = await response.json();

    // Transform to SpecListItem format
    const specs: SpecListItem[] = (records || []).map((record: any) => ({
      id: record.id,
      name: record.name,
      businessType: record.business_type || '',
      version: record.current_version || 1,
      updatedAt: record.updated_at,
    }));

    return { success: true, specs };
  } catch (error: any) {
    console.error('[CloudSpecLoader] Fetch specs error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Fetch a specific spec from the cloud
 * Uses the public get-spec endpoint (no auth required)
 */
export async function fetchSpec(
  specId: string,
  token?: string // Token is optional - endpoint is public
): Promise<CloudSpecLoaderResult> {
  try {
    // Use the InsForge edge function endpoint
    const response = await fetch(`${API_BASE_URL}/functions/get-spec?id=${specId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Spec not found' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return { success: false, error: data.error || 'Invalid response' };
    }

    const cloudSpec: CloudSpec = {
      id: data.data.id,
      name: data.data.name,
      version: data.data.version || 1,
      spec: data.data.spec,
      updatedAt: data.data.updatedAt || data.data.createdAt,
    };

    // Cache the spec locally
    await cacheSpec(cloudSpec);

    return { success: true, spec: cloudSpec, fromCache: false };
  } catch (error: any) {
    console.error('[CloudSpecLoader] Fetch spec error:', error);

    // Try to load from cache on network error
    const cached = await loadCachedSpec(specId);
    if (cached) {
      return { success: true, spec: cached, fromCache: true };
    }

    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Check if a newer version is available
 */
export async function checkForUpdate(
  specId: string,
  currentVersion: number,
  _token?: string // Token not required for public endpoint
): Promise<{ hasUpdate: boolean; newVersion?: number }> {
  try {
    // Fetch the spec to get current version
    const response = await fetch(`${API_BASE_URL}/functions/get-spec?id=${specId}`);

    if (!response.ok) {
      return { hasUpdate: false };
    }

    const data = await response.json();
    const serverVersion = data.data?.version || 0;

    return {
      hasUpdate: serverVersion > currentVersion,
      newVersion: serverVersion,
    };
  } catch (error) {
    console.error('[CloudSpecLoader] Check update error:', error);
    return { hasUpdate: false };
  }
}

/**
 * Cache spec locally
 */
async function cacheSpec(spec: CloudSpec): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(`${CACHED_SPEC_KEY}_${spec.id}`, JSON.stringify(spec)),
      AsyncStorage.setItem(`${CACHED_SPEC_VERSION_KEY}_${spec.id}`, String(spec.version)),
      AsyncStorage.setItem(`${CACHED_SPEC_TIMESTAMP_KEY}_${spec.id}`, new Date().toISOString()),
    ]);
    console.log('[CloudSpecLoader] Spec cached:', spec.id, 'v' + spec.version);
  } catch (error) {
    console.error('[CloudSpecLoader] Cache error:', error);
  }
}

/**
 * Load cached spec
 */
async function loadCachedSpec(specId: string): Promise<CloudSpec | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHED_SPEC_KEY}_${specId}`);
    if (!cached) return null;

    const spec = JSON.parse(cached) as CloudSpec;
    console.log('[CloudSpecLoader] Loaded from cache:', specId, 'v' + spec.version);
    return spec;
  } catch (error) {
    console.error('[CloudSpecLoader] Load cache error:', error);
    return null;
  }
}

/**
 * Get cached spec version (for sync checks)
 */
export async function getCachedVersion(specId: string): Promise<number | null> {
  try {
    const version = await AsyncStorage.getItem(`${CACHED_SPEC_VERSION_KEY}_${specId}`);
    return version ? parseInt(version, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Clear cached spec
 */
export async function clearCachedSpec(specId: string): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(`${CACHED_SPEC_KEY}_${specId}`),
      AsyncStorage.removeItem(`${CACHED_SPEC_VERSION_KEY}_${specId}`),
      AsyncStorage.removeItem(`${CACHED_SPEC_TIMESTAMP_KEY}_${specId}`),
    ]);
  } catch (error) {
    console.error('[CloudSpecLoader] Clear cache error:', error);
  }
}

/**
 * Get the most recently used spec ID
 */
export async function getLastUsedSpecId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('@kas_last_spec_id');
  } catch {
    return null;
  }
}

/**
 * Set the most recently used spec ID
 */
export async function setLastUsedSpecId(specId: string): Promise<void> {
  try {
    await AsyncStorage.setItem('@kas_last_spec_id', specId);
  } catch (error) {
    console.error('[CloudSpecLoader] Set last spec error:', error);
  }
}
