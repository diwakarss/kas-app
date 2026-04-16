/**
 * Preview Banner
 *
 * Shows a subtle banner when the app is in preview mode.
 * Indicates that data is read-only and for demonstration purposes.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { usePreview } from '../core/context/PreviewContext';
import { colors, spacing, typography } from '../core/theme/tokens';

export function PreviewBanner() {
  const { isPreviewMode, isLoading, error } = usePreview();

  if (!isPreviewMode) return null;

  if (isLoading) {
    return (
      <View style={[styles.banner, styles.loadingBanner]}>
        <Text style={styles.text}>Loading preview...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.banner, styles.errorBanner]}>
        <Text style={styles.text}>Preview unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        📱 Preview Mode — Sample data only
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.stream,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    // Web-specific: position at top of viewport
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    } : {}),
  },
  loadingBanner: {
    backgroundColor: colors.mist,
  },
  errorBanner: {
    backgroundColor: colors.ember,
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: typography.secondary.fontSize,
    color: colors.dawn,
    textAlign: 'center',
  },
});
