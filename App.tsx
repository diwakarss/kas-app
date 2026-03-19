import "./global.css";
import React, { Suspense, useCallback } from "react";
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
import RootNavigator from "./src/core/navigation/RootNavigator";
import ErrorBoundary from "./src/components/ErrorBoundary";

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

function AppContent() {
  return (
    <ErrorBoundary>
      <SpecProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SpecProvider>
    </ErrorBoundary>
  );
}

/**
 * Native wrapper: includes SQLiteProvider for expo-sqlite.
 * Web skips this — uses in-memory sql.js adapter instead.
 */
function NativeAppContent() {
  const { SQLiteProvider } = require("expo-sqlite");
  return (
    <SQLiteProvider databaseName="kas_app.db">
      <AppContent />
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
        <Suspense fallback={<LoadingFallback />}>
          {Platform.OS === 'web' ? <AppContent /> : <NativeAppContent />}
        </Suspense>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
