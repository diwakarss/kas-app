import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../core/navigation/types';
import { ActionProvider, Renderer, StateProvider } from '@json-render/react-native';
import { useSpec } from '../core/context/SpecContext';
import { useAnchorData } from '../hooks/useAnchorData';
import { ensureV2 } from '../core/types/kas-spec-v2';
import { buildAnchorSpec } from '../ui/spec-builders/anchor';
import { registry } from '../ui/registry';
import { colors } from '../core/theme/tokens';

export default function AnchorScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { spec, loading, error } = useSpec();
  const anchorData = useAnchorData();

  const uiSpec = useMemo(() => {
    if (!anchorData || !spec) return null;
    return buildAnchorSpec(anchorData, ensureV2(spec));
  }, [anchorData, spec]);

  const actionHandlers = useMemo(() => ({
    navigate: async (params: Record<string, unknown>) => {
      const screen = params.screen as keyof RootStackParamList;
      if (screen === 'Story') {
        navigation.navigate('Story', {
          entityType: params.entityType as string,
          entityId: params.entityId as number,
        });
      } else if (screen === 'AddFlow') {
        navigation.navigate('AddFlow', {
          entityType: params.entityType as string,
        });
      }
    },
    addEntity: async (params: Record<string, unknown>) => {
      navigation.navigate('AddFlow', {
        entityType: params.entityType as string,
      });
    },
  }), [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.ember} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mist, marginTop: 12 }}>
            Loading spec...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.ember, marginBottom: 8 }}>
            Error
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.clay, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!uiSpec) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.dawn }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mist }}>
            No anchor data available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StateProvider>
      <ActionProvider handlers={actionHandlers}>
        <Renderer spec={uiSpec} registry={registry} />
      </ActionProvider>
    </StateProvider>
  );
}
