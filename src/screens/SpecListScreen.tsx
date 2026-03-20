/**
 * Spec List Screen
 *
 * Shows user's generated apps and allows selecting one to load.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, cardStyle } from '../core/theme/tokens';
import { useAuth } from '../core/context/AuthContext';
import {
  fetchUserSpecs,
  SpecListItem,
  setLastUsedSpecId,
} from '../services/cloud-spec-loader';

interface SpecListScreenProps {
  onSelectSpec: (specId: string) => void;
}

export default function SpecListScreen({ onSelectSpec }: SpecListScreenProps) {
  const { token, signOut, user } = useAuth();
  const [specs, setSpecs] = useState<SpecListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSpecs = useCallback(async () => {
    if (!token) return;

    setError(null);
    const result = await fetchUserSpecs(token);

    if (result.success) {
      setSpecs(result.specs || []);
    } else {
      setError(result.error || 'Failed to load apps');
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [token]);

  useEffect(() => {
    loadSpecs();
  }, [loadSpecs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSpecs();
  };

  const handleSelectSpec = async (specId: string) => {
    await setLastUsedSpecId(specId);
    onSelectSpec(specId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSpec = ({ item }: { item: SpecListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => handleSelectSpec(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardVersion}>v{item.version}</Text>
      </View>
      <Text style={styles.cardType}>{item.businessType}</Text>
      <Text style={styles.cardDate}>Updated {formatDate(item.updatedAt)}</Text>
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📱</Text>
      <Text style={styles.emptyTitle}>No apps yet</Text>
      <Text style={styles.emptySubtitle}>
        Visit kas-app.com to create your first app
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'there'}</Text>
          <Text style={styles.title}>Your Apps</Text>
        </View>
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.stream} />
          <Text style={styles.loadingText}>Loading your apps...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadSpecs}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={specs}
          renderItem={renderSpec}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.stream]}
              tintColor={colors.stream}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dawn,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.secondary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 24,
  },
  signOutButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signOutText: {
    ...typography.action,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.subheading,
    flex: 1,
  },
  cardVersion: {
    ...typography.secondary,
    fontSize: 12,
    backgroundColor: `${colors.mist}30`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardType: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  cardDate: {
    ...typography.secondary,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    ...typography.warning,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.stream,
    borderRadius: 8,
  },
  retryText: {
    ...typography.action,
    color: colors.dawn,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
  },
  emptySubtitle: {
    ...typography.secondary,
    textAlign: 'center',
  },
});
