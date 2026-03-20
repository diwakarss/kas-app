import "./global.css";
import React, { Suspense, useCallback, useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "./src/core/theme/tokens";
import { SpecProvider } from "./src/core/context/SpecContext";
import { PreviewProvider, usePreview } from "./src/core/context/PreviewContext";
import { AuthProvider } from "./src/core/context/AuthContext";
import { CloudSpecProvider } from "./src/core/context/CloudSpecProvider";
import AppNavigator from "./src/core/navigation/AppNavigator";
import RootNavigator from "./src/core/navigation/RootNavigator";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { CloudSpec } from "./src/services/cloud-spec-loader";
import { getInitialDeepLink, subscribeToDeepLinks, DeepLinkResult } from "./src/services/deep-links";

SplashScreen.preventAutoHideAsync();

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.dawn }}>
      <ActivityIndicator size="large" color={colors.ember} />
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.mist, marginTop: 12 }}>
        Loading...
      </Text>
    </View>
  );
}

/**
 * Main app content with auth and cloud spec support.
 * Native apps get full auth flow; web preview mode skips auth.
 */
function MainAppContent() {
  const { isPreviewMode } = usePreview();
  const [cloudSpec, setCloudSpec] = useState<CloudSpec | null>(null);
  const [initialSpecId, setInitialSpecId] = useState<string | null>(null);

  // Handle deep links
  useEffect(() => {
    // Get initial deep link
    getInitialDeepLink().then((result) => {
      if (result?.type === 'spec' && result.specId) {
        setInitialSpecId(result.specId);
      }
    });

    // Subscribe to incoming deep links
    const unsubscribe = subscribeToDeepLinks((result: DeepLinkResult) => {
      if (result.type === 'spec' && result.specId) {
        setInitialSpecId(result.specId);
      }
    });

    return unsubscribe;
  }, []);

  const handleSpecLoaded = useCallback((spec: CloudSpec) => {
    setCloudSpec(spec);
  }, []);

  // Preview mode: use regular SpecProvider (fetches from preview API)
  if (isPreviewMode) {
    return (
      <SpecProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SpecProvider>
    );
  }

  // Normal mode: use auth + cloud spec
  return (
    <AuthProvider>
      <CloudSpecProvider cloudSpec={cloudSpec}>
        <NavigationContainer>
          <AppNavigator
            onSpecLoaded={handleSpecLoaded}
            initialSpecId={initialSpecId}
          />
        </NavigationContainer>
      </CloudSpecProvider>
    </AuthProvider>
  );
}

/**
 * Web wrapper: includes PreviewProvider for ?spec_id=xxx URL param support
 */
function WebAppContent() {
  return (
    <PreviewProvider>
      <MainAppContent />
    </PreviewProvider>
  );
}

/**
 * Native wrapper: includes SQLiteProvider for expo-sqlite.
 * Also includes PreviewProvider for consistency.
 */
function NativeAppContent() {
  const { SQLiteProvider } = require("expo-sqlite");
  return (
    <SQLiteProvider databaseName="kas_app.db">
      <PreviewProvider>
        <MainAppContent />
      </PreviewProvider>
    </SQLiteProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: colors.dawn }}
        onLayout={onLayoutRootView}
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            {Platform.OS === 'web' ? <WebAppContent /> : <NativeAppContent />}
          </Suspense>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
