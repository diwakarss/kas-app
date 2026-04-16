/**
 * App Navigator
 *
 * Handles the full app navigation flow:
 * 1. Auth screen (if not authenticated)
 * 2. Spec list (if authenticated but no spec selected)
 * 3. Main app (if spec loaded)
 *
 * Also handles deep links for spec loading.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { usePreview } from '../context/PreviewContext';
import { colors, spacing, typography } from '../theme/tokens';
import AuthScreen from '../../screens/AuthScreen';
import SpecListScreen from '../../screens/SpecListScreen';
import RootNavigator from './RootNavigator';
import {
  fetchSpec,
  getLastUsedSpecId,
  CloudSpec,
} from '../../services/cloud-spec-loader';

const Stack = createStackNavigator();

interface AppNavigatorProps {
  onSpecLoaded: (spec: CloudSpec) => void;
  initialSpecId?: string | null;
}

export default function AppNavigator({ onSpecLoaded, initialSpecId }: AppNavigatorProps) {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const { isPreviewMode } = usePreview();
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);
  const [hasSpec, setHasSpec] = useState(false);

  // Auto-load spec from deep link or last used
  useEffect(() => {
    if (isPreviewMode) {
      // Preview mode handles its own spec loading
      setHasSpec(true);
      return;
    }

    if (!isAuthenticated || !token) return;

    const loadInitialSpec = async () => {
      const specId = initialSpecId || (await getLastUsedSpecId());
      if (!specId) return;

      setSpecLoading(true);
      setSpecError(null);

      const result = await fetchSpec(specId, token);

      if (result.success && result.spec) {
        onSpecLoaded(result.spec);
        setHasSpec(true);
      } else {
        setSpecError(result.error || 'Failed to load app');
      }

      setSpecLoading(false);
    };

    loadInitialSpec();
  }, [isAuthenticated, token, initialSpecId, isPreviewMode, onSpecLoaded]);

  const handleSelectSpec = useCallback(
    async (specId: string) => {
      if (!token) return;

      setSpecLoading(true);
      setSpecError(null);

      const result = await fetchSpec(specId, token);

      if (result.success && result.spec) {
        onSpecLoaded(result.spec);
        setHasSpec(true);
      } else {
        setSpecError(result.error || 'Failed to load app');
      }

      setSpecLoading(false);
    },
    [token, onSpecLoaded]
  );

  // Preview mode: skip auth, go straight to app
  if (isPreviewMode) {
    return <RootNavigator />;
  }

  // Auth loading
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.stream} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Spec loading
  if (specLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.stream} />
        <Text style={styles.loadingText}>Loading your app...</Text>
        {specError && <Text style={styles.errorText}>{specError}</Text>}
      </View>
    );
  }

  // Not authenticated: show auth screen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Authenticated but no spec: show spec list
  if (!hasSpec) {
    return <SpecListScreen onSelectSpec={handleSelectSpec} />;
  }

  // Authenticated with spec: show main app
  return <RootNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dawn,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.secondary,
  },
  errorText: {
    ...typography.warning,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
  },
});
